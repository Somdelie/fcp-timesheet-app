import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { resolveActingForeman } from "@/lib/resolveActingForeman";

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

  // Get forForemanId from header (preferred) or query params (legacy)
  const url = new URL(req.url);
  const forForemanId =
    req.headers.get("x-acting-foreman-id")?.trim() ||
    url.searchParams.get("forForemanId");

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

  // Resolve if user is real foreman or assistant
  const resolved = await resolveActingForeman(payload.sub, forForemanId);
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status },
    );
  }

  const actingForemanId = resolved.foremanId!;
  const actingMode = resolved.mode;
  const assistantEmployeeId =
    resolved.mode === "ASSISTANT" ? resolved.assistantEmployeeId : null;

  // Validate acting foreman is assigned to the site
  const siteAssignment = await prisma.foremanSiteAssignment.findFirst({
    where: {
      foremanId: actingForemanId,
      siteId,
      startsOn: { lte: new Date() },
      OR: [{ endsOn: null }, { endsOn: { gt: new Date() } }],
    },
    select: { id: true },
  });

  if (!siteAssignment) {
    return NextResponse.json(
      { error: "You are not assigned to this site." },
      { status: 403 },
    );
  }

  const site = await prisma.site.findFirst({
    where: { id: siteId, isActive: true },
    select: { id: true },
  });
  if (!site)
    return NextResponse.json({ error: "Site not found" }, { status: 404 });

  // create/find SiteDay for this foreman on this site and date
  let siteDay = await prisma.siteDay.findFirst({
    where: { foremanId: actingForemanId, siteId, workDate },
    select: { id: true, foremanId: true, isLocked: true, siteId: true },
  });

  if (!siteDay) {
    try {
      siteDay = await prisma.siteDay.create({
        data: { siteId, foremanId: actingForemanId, workDate },
        select: { id: true, foremanId: true, isLocked: true, siteId: true },
      });
    } catch (e: any) {
      // If another request created the SiteDay concurrently, re-fetch it
      if (e?.code === "P2002") {
        siteDay = await prisma.siteDay.findFirst({
          where: { foremanId: actingForemanId, siteId, workDate },
          select: { id: true, foremanId: true, isLocked: true, siteId: true },
        });
        if (!siteDay) {
          return NextResponse.json(
            { error: "Failed to create work day record. Please try again." },
            { status: 500 },
          );
        }
      } else {
        // For any other error, return a generic message
        return NextResponse.json(
          { error: "Failed to create work day record. Please try again." },
          { status: 500 },
        );
      }
    }
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

      // Determine scan attribution based on whether this is an assistant or real foreman
      const scanData: any = {
        siteDayId: siteDay.id,
        employeeId: emp.id,
        workDate,
        siteId,
        dayRateAtScan: effectiveRate,
        qrPayload: qr as string,
      };

      // Add attribution fields for assistants
      if (actingMode === "ASSISTANT") {
        scanData.scanType = "MANUAL";
        scanData.manualReason = "ASSISTANT";
        scanData.addedByForemanId = actingForemanId;
      } else {
        // Real foreman - keep default REGULAR scan type
        scanData.scanType = "REGULAR";
      }

      await prisma.attendanceScan.create({
        data: scanData,
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
    ...(actingMode === "ASSISTANT" && {
      acting: {
        mode: actingMode,
        foremanId: actingForemanId,
      },
    }),
  });
}
