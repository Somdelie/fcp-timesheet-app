import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function startOfDayUTC(dateISO: string) {
  const d = new Date(`${dateISO}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid workDateISO");
  return d;
}

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  const payload = await verifyApiToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // For now: foremen book attendance
  if (payload.role !== "FOREMAN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const siteId = String(body?.siteId ?? "");
  const workDateISO = String(body?.workDateISO ?? "");
  const scans = Array.isArray(body?.scans) ? body.scans : [];
  const latitude = typeof body?.latitude === "number" ? body.latitude : null;
  const longitude = typeof body?.longitude === "number" ? body.longitude : null;
  const address =
    typeof body?.address === "string" ? body.address.trim() || null : null;

  if (!siteId || !workDateISO) {
    return NextResponse.json(
      { error: "siteId and workDateISO required" },
      { status: 400 },
    );
  }

  if (scans.length === 0) {
    return NextResponse.json({ error: "No scans submitted" }, { status: 400 });
  }

  const workDate = startOfDayUTC(workDateISO);

  const foreman = await prisma.foreman.findUnique({
    where: { userId: payload.sub },
    select: { id: true },
  });
  if (!foreman) {
    return NextResponse.json(
      { error: "Foreman profile missing" },
      { status: 403 },
    );
  }

  const site = await prisma.site.findFirst({
    where: { id: siteId, isActive: true },
    select: { id: true },
  });
  if (!site)
    return NextResponse.json({ error: "Site not found" }, { status: 404 });

  // create/find SiteDay for this foreman
  let siteDay = await prisma.siteDay.findFirst({
    where: { foremanId: foreman.id, workDate },
    select: { id: true, foremanId: true, isLocked: true },
  });

  if (!siteDay) {
    siteDay = await prisma.siteDay.create({
      data: { siteId, foremanId: foreman.id, workDate },
      select: { id: true, foremanId: true, isLocked: true },
    });
  }

  if (siteDay.isLocked) {
    return NextResponse.json({ error: "Day is locked" }, { status: 409 });
  }

  const qrValues = scans
    .map((s: any) => String(s?.qrCodeValue ?? "").trim())
    .filter(Boolean);

  // optional local dedupe to reduce DB churn
  const uniqueQrValues = Array.from(new Set(qrValues));

  // Get company default day rate
  const companySetting = await prisma.companySettings.findUnique({
    where: { id: "singleton" },
    select: { defaultEmployeeDayRate: true },
  });
  const defaultRate = companySetting?.defaultEmployeeDayRate;

  const employees = await prisma.employee.findMany({
    where: { qrCodeValue: { in: uniqueQrValues as string[] } },
    select: {
      id: true,
      qrCodeValue: true,
      isActive: true,
      defaultDayRate: true,
    },
  });

  const byQr = new Map(employees.map((e) => [e.qrCodeValue, e]));

  const results: Array<{
    qrCodeValue: string;
    status: "CREATED" | "ALREADY_SCANNED" | "UNKNOWN" | "INACTIVE";
  }> = [];

  for (const qr of uniqueQrValues) {
    const emp = byQr.get(qr as string);

    if (!emp) {
      results.push({ qrCodeValue: qr as string, status: "UNKNOWN" });
      continue;
    }
    if (!emp.isActive) {
      results.push({ qrCodeValue: qr as string, status: "INACTIVE" });
      continue;
    }

    try {
      const effectiveRate = emp.defaultDayRate || defaultRate;

      if (!effectiveRate) {
        results.push({ qrCodeValue: qr as string, status: "UNKNOWN" });
        continue;
      }

      await prisma.attendanceScan.create({
        data: {
          siteDayId: siteDay.id,
          employeeId: emp.id,
          workDate,
          siteId,
          dayRateAtScan: effectiveRate,
          qrPayload: qr as string,
          latitude,
          longitude,
          address,
        },
      });
      results.push({ qrCodeValue: qr as string, status: "CREATED" });
    } catch (e: any) {
      if (String(e?.code) === "P2002") {
        results.push({ qrCodeValue: qr as string, status: "ALREADY_SCANNED" });
        continue;
      }
      return NextResponse.json(
        { error: "Failed to create scans" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    ok: true,
    siteDayId: siteDay.id,
    results,
  });
}
