// app/api/app/admin/cards/bulk-seed/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

type ImportRow = {
  line: number;
  name: string;
  email?: string;
  cardNumber: string;
  role?: string;
  sourceFile?: string;
};

function normalizeCardNumber(raw: string) {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function normalizeName(raw: string) {
  return String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function splitName(name: string) {
  const clean = normalizeName(name);
  const parts = clean.split(" ").filter(Boolean);
  return {
    firstName: parts[0] ?? "UNKNOWN",
    lastName: parts.slice(1).join(" ") || "UNKNOWN",
  };
}

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!user?.id) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS_HEADERS },
      ),
    };
  }

  if (user.role !== "ADMIN") {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Forbidden" },
        { status: 403, headers: CORS_HEADERS },
      ),
    };
  }

  return { ok: true as const, user };
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

async function parsePdfFile(file: File, line: number): Promise<ImportRow> {
  const pdfParseModule: any = await import("pdf-parse");
  const pdfParse = pdfParseModule.default ?? pdfParseModule;

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = await pdfParse(buffer);
  const text = String(parsed.text ?? "").replace(/\r/g, "\n");

  const cardMatch = text.match(
    /WORKER\s+([\s\S]*?)\s+WORKER ID\s+([A-Z0-9]+)/i,
  );
  const fallbackName = text.match(
    /Attendance Card[\s\S]*?WORKER\s+([A-Z][A-Z\s.'-]+)/i,
  );
  const fallbackCard = text.match(/WORKER ID\s+([A-Z0-9]+)/i);

  const name = normalizeName(cardMatch?.[1] ?? fallbackName?.[1] ?? "");
  const cardNumber = normalizeCardNumber(
    cardMatch?.[2] ?? fallbackCard?.[1] ?? "",
  );

  return {
    line,
    name,
    cardNumber,
    role: "WORKER",
    sourceFile: file.name,
  };
}

async function buildPreview(rows: ImportRow[]) {
  const normalizedRows = rows.map((row) => ({
    ...row,
    name: normalizeName(row.name),
    cardNumber: normalizeCardNumber(row.cardNumber),
    role: row.role || "WORKER",
  }));

  const seenCards = new Set<string>();
  const cards = normalizedRows.map((row) => row.cardNumber).filter(Boolean);
  const names = normalizedRows
    .map((row) => normalizeName(row.name))
    .filter(Boolean);

  const employees = await prisma.employee.findMany({
    where: {
      OR: [
        { qrCodeValue: { in: cards } },
        ...names.map((name) => {
          const { firstName, lastName } = splitName(name);
          return { firstName, lastName };
        }),
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      qrCodeValue: true,
      isActive: true,
    },
  });

  let createCount = 0;
  let updateCount = 0;
  let reactivateCount = 0;
  let warningCount = 0;
  let errorCount = 0;

  const previewRows = normalizedRows.map((row) => {
    let status: "valid" | "warning" | "error" = "valid";
    let message: string | null = null;
    let action = "CREATE_EMPLOYEE";
    let existingEmployeeName: string | null = null;

    if (!row.name || !row.cardNumber) {
      status = "error";
      message = "Name and card number are required.";
      action = "SKIP";
      errorCount++;
      return { ...row, status, message, action, existingEmployeeName };
    }

    if (seenCards.has(row.cardNumber)) {
      status = "error";
      message = "Duplicate card number in this import.";
      action = "SKIP";
      errorCount++;
      return { ...row, status, message, action, existingEmployeeName };
    }

    seenCards.add(row.cardNumber);

    const byCard = employees.find((e) => e.qrCodeValue === row.cardNumber);
    const { firstName, lastName } = splitName(row.name);
    const byName = employees.find(
      (e) =>
        normalizeName(`${e.firstName} ${e.lastName}`) ===
        normalizeName(`${firstName} ${lastName}`),
    );

    const employee = byCard ?? byName;

    if (employee) {
      existingEmployeeName = `${employee.firstName} ${employee.lastName}`;

      if (!employee.isActive) {
        action = "REACTIVATE_AND_UPDATE_CARD";
        reactivateCount++;
        status = "warning";
        message = "Employee exists but is inactive. It will be reactivated.";
        warningCount++;
      } else if (employee.qrCodeValue !== row.cardNumber) {
        action = "UPDATE_CARD";
        updateCount++;
      } else {
        action = "NO_CHANGE";
        updateCount++;
      }
    } else {
      createCount++;
    }

    return { ...row, status, message, action, existingEmployeeName };
  });

  return {
    rows: previewRows,
    summary: {
      totalRows: previewRows.length,
      createCount,
      updateCount,
      reactivateCount,
      warningCount,
      errorCount,
    },
  };
}

async function saveRows(rows: ImportRow[], adminUserId: string) {
  const preview = await buildPreview(rows);

  if (preview.summary.errorCount > 0) {
    return { ...preview, saved: false };
  }

  let createdCount = 0;
  let updatedCount = 0;
  let matchedScanCount = 0;

  await prisma.$transaction(async (tx) => {
    for (const row of preview.rows) {
      const cardNumber = normalizeCardNumber(row.cardNumber);
      const { firstName, lastName } = splitName(row.name);

      const existing = await tx.employee.findFirst({
        where: {
          OR: [{ qrCodeValue: cardNumber }, { firstName, lastName }],
        },
      });

      let employeeId: string;

      if (existing) {
        const updated = await tx.employee.update({
          where: { id: existing.id },
          data: {
            firstName,
            lastName,
            qrCodeValue: cardNumber,
            isActive: true,
          },
        });
        employeeId = updated.id;
        updatedCount++;
      } else {
        const created = await tx.employee.create({
          data: {
            firstName,
            lastName,
            qrCodeValue: cardNumber,
            isActive: true,
            createdByUserId: adminUserId,
          },
        });
        employeeId = created.id;
        createdCount++;
      }

      const matched = await tx.attendanceCardScan.updateMany({
        where: { cardNumber, status: "UNMATCHED" },
        data: { status: "MATCHED", employeeId },
      });

      matchedScanCount += matched.count;
    }
  });

  return {
    ...preview,
    saved: true,
    summary: {
      ...preview.summary,
      createdCount,
      updatedCount,
      matchedScanCount,
    },
  };
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const contentType = req.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const dryRun = form.get("dryRun") !== "false";
      const files = form
        .getAll("files")
        .filter((item): item is File => item instanceof File);

      if (files.length === 0) {
        return NextResponse.json(
          { error: "Upload at least one PDF." },
          { status: 400, headers: CORS_HEADERS },
        );
      }

      if (files.length > 30) {
        return NextResponse.json(
          { error: "Maximum 30 PDFs per import." },
          { status: 400, headers: CORS_HEADERS },
        );
      }

      const rows = await Promise.all(
        files.map((file, index) => parsePdfFile(file, index + 1)),
      );
      const result = dryRun
        ? await buildPreview(rows)
        : await saveRows(rows, auth.user.id);

      return NextResponse.json(
        { ok: true, source: "pdf", ...result },
        { headers: CORS_HEADERS },
      );
    }

    let body: any = await req.json().catch(() => null);
    if (!body) {
      try {
        const raw = await req.text();
        if (raw) body = JSON.parse(raw);
      } catch {
        /* ignore */
      }
    }

    const rows = Array.isArray(body?.rows) ? body.rows : [];
    const dryRun = body?.dryRun !== false;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No rows provided." },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const result = dryRun
      ? await buildPreview(rows)
      : await saveRows(rows, auth.user.id);
    return NextResponse.json(
      { ok: true, source: "json", ...result },
      { headers: CORS_HEADERS },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Bulk card import failed.",
      },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
