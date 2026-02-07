import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { randomBytes } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}
function clean(s: unknown) {
  return String(s ?? "").trim();
}

function parseMoneyToDecimalString(v: unknown) {
  const s = String(v ?? "")
    .trim()
    .replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n.toFixed(2);
}

function generateEmployeeQrValue() {
  const token = randomBytes(8).toString("hex").toUpperCase();
  return token;
}

export async function GET(req: Request) {
  try {
    const token = getBearer(req);
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await verifyApiToken(token);
    if (!payload || payload.role !== "FOREMAN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const foreman = await prisma.foreman.findUnique({
      where: { userId: payload.sub },
      select: { id: true },
    });
    if (!foreman)
      return NextResponse.json(
        { error: "Foreman profile missing" },
        { status: 404 },
      );

    const url = new URL(req.url);
    const qRaw = (url.searchParams.get("q") || "").trim();
    const show = url.searchParams.get("show") || "active"; // "active" | "all"
    const onlyActive = show !== "all";

    const where: any = {
      OR: [
        // workers this foreman created
        { createdByUserId: payload.sub },
        // workers explicitly linked via ForemanEmployee (visibility/booking)
        {
          foremanLinks: {
            some: {
              foremanId: foreman.id,
            },
          },
        },
        // workers he has ever booked on his own site days (timesheets)
        {
          attendance: {
            some: {
              siteDay: { foremanId: foreman.id },
            },
          },
        },
      ],
    };

    if (onlyActive) {
      where.isActive = true;
    }

    if (qRaw) {
      where.AND = [
        ...(where.AND ?? []),
        {
          OR: [
            { firstName: { contains: qRaw, mode: "insensitive" } },
            { lastName: { contains: qRaw, mode: "insensitive" } },
            { qrCodeValue: { contains: qRaw, mode: "insensitive" } },
          ],
        },
      ];
    }

    const employees = await prisma.employee.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        qrCodeValue: true,
        defaultDayRate: true,
        faceImageUrl: true,
        isActive: true,
      },
    });

    const items = employees.map((e) => ({
      id: e.id,
      code: e.qrCodeValue,
      fullName: `${e.firstName} ${e.lastName}`.trim(),
      dayRate: Number(e.defaultDayRate),
      active: e.isActive,
      faceImageUrl: e.faceImageUrl ?? null,
    }));

    return NextResponse.json({ employees: items });
  } catch (e: any) {
    console.error("Foreman list employees error", e);
    return NextResponse.json(
      { error: e?.message ?? "Failed to load employees." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const token = getBearer(req);
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await verifyApiToken(token);
    if (!payload || payload.role !== "FOREMAN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const foreman = await prisma.foreman.findUnique({
      where: { userId: payload.sub },
      select: { id: true },
    });
    if (!foreman)
      return NextResponse.json(
        { error: "Foreman profile missing" },
        { status: 404 },
      );

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const firstName = clean(body.firstName);
    const lastName = clean(body.lastName);
    const isActive = body.active !== undefined ? Boolean(body.active) : true;

    if (!firstName)
      return NextResponse.json(
        { error: "First name is required." },
        { status: 400 },
      );
    if (!lastName)
      return NextResponse.json(
        { error: "Last name is required." },
        { status: 400 },
      );

    // Get default day rate from company settings
    const settings = await prisma.companySettings.findUnique({
      where: { id: "singleton" },
    });
    const dayRateStr = (settings?.defaultEmployeeDayRate || "0").toString();

    const MAX_TRIES = 5;

    for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
      const qrCodeValue = generateEmployeeQrValue();

      try {
        const created = await prisma.$transaction(async (tx) => {
          const employee = await tx.employee.create({
            data: {
              firstName,
              lastName,
              qrCodeValue,
              defaultDayRate: dayRateStr as any,
              faceImageUrl: null,
              isActive,
              createdByUserId: payload.sub,
            },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              qrCodeValue: true,
              defaultDayRate: true,
              faceImageUrl: true,
              isActive: true,
            },
          });

          await tx.foremanEmployee.upsert({
            where: {
              foremanId_employeeId: {
                foremanId: foreman.id,
                employeeId: employee.id,
              },
            },
            update: { reason: "created" },
            create: {
              foremanId: foreman.id,
              employeeId: employee.id,
              reason: "created",
            },
          });

          return employee;
        });

        const employeeDto = {
          id: created.id,
          code: created.qrCodeValue,
          fullName: `${created.firstName} ${created.lastName}`.trim(),
          dayRate: Number(created.defaultDayRate),
          active: created.isActive,
          faceImageUrl: created.faceImageUrl ?? null,
        };

        return NextResponse.json({ employee: employeeDto }, { status: 201 });
      } catch (e: any) {
        if (String(e?.code) === "P2002") {
          const target = e?.meta?.target;
          const t = Array.isArray(target)
            ? target.join(",")
            : String(target ?? "");
          if (t.includes("qrCodeValue")) continue;
          return NextResponse.json(
            { error: "Employee violates a unique constraint." },
            { status: 400 },
          );
        }

        console.error("Foreman create employee error (attempt)", e);
        return NextResponse.json(
          { error: "Failed to create employee." },
          { status: 500 },
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to generate unique QR. Try again." },
      { status: 500 },
    );
  } catch (e: any) {
    console.error("Foreman create employee error", e);
    return NextResponse.json(
      { error: e?.message ?? "Failed to create employee." },
      { status: 500 },
    );
  }
}
