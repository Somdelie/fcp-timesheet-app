import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { randomBytes } from "crypto";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PDFParse } = require("pdf-parse");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
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

function normalizeCardNumber(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function normalizeEmail(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function normalizeName(value: unknown) {
  return String(value ?? "").trim();
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: "", lastName: "" };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }

  const lastName = parts.pop() ?? "";
  return { firstName: parts.join(" "), lastName };
}

function randomQrCodeValue() {
  return randomBytes(8).toString("hex").toUpperCase();
}

function formatEmployeeName(employee: { firstName: string; lastName: string }) {
  return `${employee.firstName} ${employee.lastName}`.trim();
}

type BulkSeedInputRow = {
  name?: string;
  email?: string;
  cardNumber?: string;
  role?: string;
  sourceFile?: string;
  [key: string]: unknown;
};

type ParsedSeedRow = {
  line: number;
  rawName: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  cardNumber: string;
  role: string;
  original: BulkSeedInputRow;
};

type PreviewSeedRow = {
  line: number;
  name: string;
  email: string | null;
  cardNumber: string | null;
  role: string;
  action: string;
  status: "valid" | "warning" | "error";
  message: string | null;
  existingEmployeeId: string | null;
  existingEmployeeName: string | null;
};

async function extractPdfRows(file: File): Promise<BulkSeedInputRow[]> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const parser = new PDFParse({ data: buffer } as any);
  const result = await parser.getText();
  await parser.destroy();

  const rawText = String(result.text ?? "");

  const lines = rawText
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  function cleanName(value: string) {
    return value
      .replace(/…/g, "")
      .replace(/\.\.\./g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanCardNumber(value: string) {
    return value
      .replace(/^EMP[-\s]*/i, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .trim()
      .toUpperCase();
  }

  function nextUsefulLine(index: number) {
    for (let i = index + 1; i < lines.length; i += 1) {
      const line = lines[i];

      if (
        /^attendance card$/i.test(line) ||
        /^scan to clock in$/i.test(line) ||
        /^present this card/i.test(line) ||
        /^no scan/i.test(line) ||
        /^id:/i.test(line) ||
        /^©/i.test(line) ||
        /^this photo/i.test(line)
      ) {
        continue;
      }

      return line;
    }

    return "";
  }

  let name = "";
  let cardNumber = "";

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (/^worker$/i.test(line) && !name) {
      name = cleanName(nextUsefulLine(i));
    }

    if (/^worker id$/i.test(line) && !cardNumber) {
      cardNumber = cleanCardNumber(nextUsefulLine(i));
    }
  }

  if (!name) {
    const pageTwoName = lines.find((line) => {
      const cleaned = cleanName(line);
      return (
        /^[A-Z][A-Z\s.'-]{4,}$/i.test(cleaned) &&
        !/attendance|worker|scan|project|photo|rights/i.test(cleaned)
      );
    });

    name = cleanName(pageTwoName ?? "");
  }

  if (!cardNumber) {
    const idLine = lines.find((line) => /EMP[-\s]*[A-Z0-9]{8,}/i.test(line));
    const match = idLine?.match(/EMP[-\s]*([A-Z0-9]{8,})/i);
    cardNumber = cleanCardNumber(match?.[1] ?? "");
  }

  return [
    {
      line: 1,
      name,
      email: "",
      cardNumber,
      role: "WORKER",
      sourceFile: file.name,
    },
  ];
}

async function buildPreview(rows: ParsedSeedRow[]) {
  const emailMap = new Map<string, number[]>();
  const cardNumberMap = new Map<string, number[]>();
  const nameMap = new Map<string, number[]>();

  for (const row of rows) {
    if (row.email) {
      const key = row.email;
      emailMap.set(key, [...(emailMap.get(key) ?? []), row.line]);
    }
    if (row.cardNumber) {
      const key = row.cardNumber;
      cardNumberMap.set(key, [...(cardNumberMap.get(key) ?? []), row.line]);
    }
    if (row.name) {
      const key = row.name.toLowerCase();
      nameMap.set(key, [...(nameMap.get(key) ?? []), row.line]);
    }
  }

  const emailLookup = Array.from(emailMap.keys());
  const cardNumberLookup = Array.from(cardNumberMap.keys());
  const nameLookup = Array.from(nameMap.keys());

  const employeeConditions: any[] = [];
  if (emailLookup.length > 0) {
    employeeConditions.push({ user: { email: { in: emailLookup } } });
  }
  if (cardNumberLookup.length > 0) {
    employeeConditions.push({ qrCodeValue: { in: cardNumberLookup } });
  }
  for (const nameKey of nameLookup) {
    const parts = nameKey.split(/\s+/).filter(Boolean);
    if (parts.length === 0) continue;
    if (parts.length === 1) {
      employeeConditions.push({
        OR: [
          { firstName: { equals: parts[0], mode: "insensitive" } },
          { lastName: { equals: parts[0], mode: "insensitive" } },
        ],
      });
    } else {
      const lastName = parts[parts.length - 1];
      const firstName = parts.slice(0, -1).join(" ");
      employeeConditions.push({
        AND: [
          { firstName: { equals: firstName, mode: "insensitive" } },
          { lastName: { equals: lastName, mode: "insensitive" } },
        ],
      });
    }
  }

  const existingEmployees = employeeConditions.length
    ? await prisma.employee.findMany({
        where: { OR: employeeConditions },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          qrCodeValue: true,
          isActive: true,
          user: { select: { email: true } },
        },
      })
    : [];

  const existingUsersByEmail = await prisma.user.findMany({
    where: {
      email: { in: emailLookup },
      employee: { is: null },
    },
    select: { id: true, email: true },
  });

  const employeesByEmail = new Map<string, (typeof existingEmployees)[0]>();
  const employeesByCard = new Map<string, (typeof existingEmployees)[0]>();
  const employeesByName = new Map<string, (typeof existingEmployees)[0][]>();

  for (const employee of existingEmployees) {
    if (employee.user?.email) {
      employeesByEmail.set(employee.user.email.toLowerCase(), employee);
    }
    if (employee.qrCodeValue) {
      employeesByCard.set(employee.qrCodeValue, employee);
    }
    const fullName = `${employee.firstName} ${employee.lastName}`
      .trim()
      .toLowerCase();
    if (fullName) {
      employeesByName.set(fullName, [
        ...(employeesByName.get(fullName) ?? []),
        employee,
      ]);
    }
  }

  const previewRows: PreviewSeedRow[] = rows.map((row) => {
    let action = "create";
    let status: "valid" | "warning" | "error" = "valid";
    let message: string | null = null;
    let matchedEmployee: (typeof existingEmployees)[0] | null = null;

    if (!row.name && !row.email) {
      status = "error";
      message = "Missing name or email";
      action = "invalid";
    }

    const exactEmailMatch = row.email
      ? employeesByEmail.get(row.email)
      : undefined;
    const exactCardMatch = row.cardNumber
      ? employeesByCard.get(row.cardNumber)
      : undefined;
    const exactNameMatch = row.name
      ? employeesByName.get(row.name.toLowerCase())
      : undefined;

    const parsedName = row.name.toLowerCase();
    const hasDuplicateEmail =
      row.email && (emailMap.get(row.email)?.length ?? 0) > 1;
    const hasDuplicateCard =
      row.cardNumber && (cardNumberMap.get(row.cardNumber)?.length ?? 0) > 1;
    const hasDuplicateName =
      row.name && (nameMap.get(parsedName)?.length ?? 1) > 1;

    if (exactEmailMatch) {
      matchedEmployee = exactEmailMatch;
      action = row.cardNumber ? "updateCard" : "reactivate";
    } else if (exactCardMatch) {
      matchedEmployee = exactCardMatch;

      action = "skip";

      status = "warning";

      message =
        row.name &&
        row.name.toLowerCase() !==
          formatEmployeeName(matchedEmployee).toLowerCase()
          ? `Card already belongs to ${formatEmployeeName(
              matchedEmployee,
            )}. Row will be skipped.`
          : "Card already exists. Row will be skipped.";
      if (
        row.name &&
        row.name.toLowerCase() !==
          formatEmployeeName(matchedEmployee).toLowerCase()
      ) {
        status = "warning";
        message = "Card already exists for a different person";
      }
    } else if (exactNameMatch && exactNameMatch.length === 1) {
      matchedEmployee = exactNameMatch[0];
      action = row.cardNumber ? "updateCard" : "reactivate";
    } else if (exactNameMatch && exactNameMatch.length > 1) {
      status = "error";
      message = "Name matches multiple employees";
      action = "invalid";
    }

    // if (row.cardNumber && !matchedEmployee) {
    //   const existingCard = employeesByCard.get(row.cardNumber);
    //   if (existingCard) {
    //     status = "warning";
    //     message = "Card already assigned to another employee";
    //     action = "invalid";
    //   }
    // }

    if (!row.cardNumber && action === "create") {
      if (!row.name) {
        status = "error";
        message = "Name is required to create a new employee";
        action = "invalid";
      }
    }

    if (hasDuplicateEmail) {
      status = status === "error" ? status : "warning";
      message = message
        ? `${message}; duplicate email in import`
        : "Duplicate email in import";
    }
    if (hasDuplicateCard) {
      status = status === "error" ? status : "warning";
      message = message
        ? `${message}; duplicate card in import`
        : "Duplicate card in import";
    }
    if (hasDuplicateName) {
      status = status === "error" ? status : "warning";
      message = message
        ? `${message}; duplicate name in import`
        : "Duplicate name in import";
    }

    if (status === "valid" && action === "create" && !row.cardNumber) {
      message =
        "No card assigned yet — will create employee and allow later linking";
      status = "warning";
    }

    if (
      status === "valid" &&
      action === "reactivate" &&
      matchedEmployee?.isActive
    ) {
      status = "valid";
      message = "Existing employee will remain active";
    }

    return {
      line: row.line,
      name: row.name,
      email: row.email || null,
      cardNumber: row.cardNumber || null,
      role: row.role,
      action,
      status,
      message,
      existingEmployeeId: matchedEmployee?.id ?? null,
      existingEmployeeName: matchedEmployee
        ? formatEmployeeName(matchedEmployee)
        : null,
    };
  });

  const summary = {
    totalRows: previewRows.length,
    createCount: previewRows.filter(
      (previewRow) => previewRow.action === "create",
    ).length,
    updateCount: previewRows.filter(
      (previewRow) => previewRow.action === "updateCard",
    ).length,
    reactivateCount: previewRows.filter(
      (previewRow) => previewRow.action === "reactivate",
    ).length,
    warningCount: previewRows.filter(
      (previewRow) => previewRow.status === "warning",
    ).length,
    errorCount: previewRows.filter(
      (previewRow) => previewRow.status === "error",
    ).length,
  };

  return { previewRows, summary, existingUsersByEmail };
}

async function saveRows(
  previewRows: PreviewSeedRow[],
  existingUsersByEmail: any[],
) {
  let createdCount = 0;
  let updatedCount = 0;
  let matchedScanCount = 0;

  const settings = await prisma.companySettings.findUnique({
    where: { id: "singleton" },
  });
  const defaultDayRate = settings?.defaultEmployeeDayRate
    ? String(settings.defaultEmployeeDayRate)
    : "0";

  const resultRows = await prisma.$transaction(async (tx) => {
    const createdRows = [] as typeof previewRows;
    for (const row of previewRows) {
      if (row.action === "skip") {
        createdRows.push(row);
        continue;
      }
      if (row.action === "invalid") {
        createdRows.push(row);
        continue;
      }

      let employeeId = row.existingEmployeeId;
      if (row.action === "create") {
        const { firstName, lastName } = splitName(row.name);

        const matchedUser = row.email
          ? existingUsersByEmail.find(
              (user) => user.email.toLowerCase() === row.email,
            )
          : undefined;

        const employee = await tx.employee.create({
          data: {
            firstName,
            lastName,
            phone: null,
            defaultDayRate,
            isActive: true,
            qrCodeValue: row.cardNumber || randomQrCodeValue(),
            user: matchedUser ? { connect: { id: matchedUser.id } } : undefined,
          },
        });

        employeeId = employee.id;
        createdCount += 1;
      }

      if (row.action === "updateCard" || row.action === "reactivate") {
        const updatedData: Record<string, unknown> = { isActive: true };
        if (row.action === "updateCard" && row.cardNumber) {
          updatedData.qrCodeValue = row.cardNumber;
        }

        await tx.employee.update({
          where: { id: employeeId! },
          data: updatedData,
        });
        updatedCount += 1;
      }

      if (row.cardNumber && employeeId) {
        try {
          const scanUpdate = await tx.attendanceCardScan.updateMany({
            where: {
              cardNumber: row.cardNumber,
              status: "UNMATCHED",
            },
            data: {
              status: "MATCHED",
              employeeId,
            },
          });

          matchedScanCount += scanUpdate.count;
        } catch (error: any) {
          if (
            error?.code !== "P2021" &&
            !String(error?.message ?? "").includes("AttendanceCardScan")
          ) {
            throw error;
          }
        }
      }

      createdRows.push(row);
    }

    return createdRows;
  });

  return { resultRows, createdCount, updatedCount, matchedScanCount };
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const contentType = req.headers.get("content-type") ?? "";

  try {
    // Handle multipart/form-data (PDF uploads)
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

      const allRows: BulkSeedInputRow[] = [];
      for (const file of files) {
        const rows = await extractPdfRows(file);
        allRows.push(...rows);
      }

      const rows = allRows.map((row: any, index: number) => {
        const name = normalizeName(row.name);
        const email = normalizeEmail(row.email);
        const cardNumber = normalizeCardNumber(row.cardNumber);
        const role = normalizeName(row.role).toUpperCase() || "WORKER";
        const { firstName, lastName } = splitName(name);

        return {
          line: index + 1,
          rawName: row.name ?? "",
          name,
          firstName,
          lastName,
          email,
          cardNumber,
          role,
          original: row,
        };
      });

      const { previewRows, summary, existingUsersByEmail } =
        await buildPreview(rows);

      if (!dryRun && summary.errorCount > 0) {
        return NextResponse.json(
          {
            error: "Fix rows with errors before saving",
            rows: previewRows,
            summary,
          },
          { status: 400, headers: CORS_HEADERS },
        );
      }

      if (!dryRun) {
        const { createdCount, updatedCount, matchedScanCount } = await saveRows(
          previewRows,
          existingUsersByEmail,
        );
        return NextResponse.json(
          {
            ok: true,
            rows: previewRows,
            summary: {
              ...summary,
              createdCount,
              updatedCount,
              matchedScanCount,
            },
          },
          { headers: CORS_HEADERS },
        );
      }

      return NextResponse.json(
        {
          ok: true,
          rows: previewRows,
          summary,
        },
        { headers: CORS_HEADERS },
      );
    }

    // Handle JSON body (CSV or manual entries)
    let body: any = await req.json().catch(() => null);
    if (!body) {
      try {
        const raw = await req.text();
        if (raw) body = JSON.parse(raw);
      } catch {
        /* ignore */
      }
    }

    const rawRows = Array.isArray(body?.rows)
      ? (body.rows as BulkSeedInputRow[])
      : [];
    const dryRun = body?.dryRun === true;

    if (rawRows.length === 0) {
      return NextResponse.json(
        { error: "No rows provided", rows: [], summary: null },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const rows = rawRows.map((row: any, index: number) => {
      const name = normalizeName(row.name);
      const email = normalizeEmail(row.email);
      const cardNumber = normalizeCardNumber(row.cardNumber);
      const role = normalizeName(row.role).toUpperCase() || "WORKER";
      const { firstName, lastName } = splitName(name);

      return {
        line: index + 1,
        rawName: row.name ?? "",
        name,
        firstName,
        lastName,
        email,
        cardNumber,
        role,
        original: row,
      };
    });

    const { previewRows, summary, existingUsersByEmail } =
      await buildPreview(rows);

    if (!dryRun && summary.errorCount > 0) {
      return NextResponse.json(
        {
          error: "Fix rows with errors before saving",
          rows: previewRows,
          summary,
        },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    if (!dryRun) {
      const { createdCount, updatedCount, matchedScanCount } = await saveRows(
        previewRows,
        existingUsersByEmail,
      );
      return NextResponse.json(
        {
          ok: true,
          rows: previewRows,
          summary: {
            ...summary,
            createdCount,
            updatedCount,
            matchedScanCount,
          },
        },
        { headers: CORS_HEADERS },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        rows: previewRows,
        summary,
      },
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
