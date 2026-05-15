import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { parseClaimBuffers } from "@/lib/claim-pdf-parser";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILES = 50;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

type ClaimStatus = "SUBMITTED" | "PARTIALLY_RECEIVED" | "RECEIVED";

function deriveStatus(claimed: number, received: number): ClaimStatus {
  if (received <= 0) return "SUBMITTED";
  if (received >= claimed) return "RECEIVED";
  return "PARTIALLY_RECEIVED";
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  if (!session || !["ADMIN", "OFFICE"].includes(role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const action = (formData.get("action") as string | null) ?? "parse";
  if (!["parse", "import"].includes(action)) {
    return NextResponse.json({ error: 'action must be "parse" or "import"' }, { status: 400 });
  }

  const pdfEntries = formData.getAll("pdfs");
  if (!pdfEntries.length) {
    return NextResponse.json({ error: "No PDF files provided" }, { status: 400 });
  }
  if (pdfEntries.length > MAX_FILES) {
    return NextResponse.json({ error: `Too many files (max ${MAX_FILES})` }, { status: 400 });
  }

  const buffers: { name: string; buffer: Buffer }[] = [];
  for (const entry of pdfEntries) {
    if (!(entry instanceof File) || !entry.size) continue;
    if (entry.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `"${entry.name}" exceeds 10 MB limit` }, { status: 400 });
    }
    buffers.push({ name: entry.name, buffer: Buffer.from(await entry.arrayBuffer()) });
  }

  const parsed = await parseClaimBuffers(buffers);

  // ── Resolve sites ──
  const siteCodes = [...new Set(parsed.flatMap((p) => (p.claim ? [p.claim.siteCode] : [])))];
  const sites = await prisma.site.findMany({
    where: { code: { in: siteCodes } },
    select: { id: true, code: true, name: true },
  });
  const siteMap = new Map(sites.map((s) => [s.code!, { id: s.id, name: s.name }]));

  // ── Most recent existing claim per site ──
  const siteIds = sites.map((s) => s.id);
  const existingClaims = siteIds.length
    ? await prisma.siteClaim.findMany({
        where: { siteId: { in: siteIds } },
        orderBy: { claimDate: "desc" },
        select: { id: true, siteId: true, claimDate: true },
      })
    : [];
  const existingBySiteId = new Map<string, { id: string; claimDate: Date }>();
  for (const c of existingClaims) {
    if (!existingBySiteId.has(c.siteId)) existingBySiteId.set(c.siteId, c);
  }

  // ── Build claim rows (most recent PDF per site wins if multiple dropped) ──
  type ClaimRow = {
    fileName: string;
    siteCode: string;
    siteName: string | null;
    claimDate: Date;
    amountClaimed: number;
    amountReceived: number;
    outstanding: number;
    claimStatus: ClaimStatus;
    dbAction: "CREATE" | "UPDATE";
    parseWarning?: string;
  };

  const rowsBySiteCode = new Map<string, ClaimRow>();

  for (const { fileName, claim } of parsed) {
    if (!claim) continue;
    const site = siteMap.get(claim.siteCode);
    if (!site) continue;

    const outstanding = Math.max(0, claim.amountClaimed - claim.amountReceived);
    const existing = existingBySiteId.get(site.id);

    const row: ClaimRow = {
      fileName,
      siteCode: claim.siteCode,
      siteName: site.name ?? null,
      claimDate: claim.claimDate,
      amountClaimed: claim.amountClaimed,
      amountReceived: claim.amountReceived,
      outstanding,
      claimStatus: deriveStatus(claim.amountClaimed, claim.amountReceived),
      dbAction: existing ? "UPDATE" : "CREATE",
      parseWarning: claim.parseWarning,
    };

    const prev = rowsBySiteCode.get(claim.siteCode);
    if (!prev || claim.claimDate > prev.claimDate) {
      rowsBySiteCode.set(claim.siteCode, row);
    }
  }

  const claimRows = [...rowsBySiteCode.values()];
  const parseErrors = parsed
    .filter((p) => !p.claim || p.error)
    .map((p) => ({ fileName: p.fileName, error: p.error ?? "Could not parse claim data" }));
  const missingSiteErrors = parsed
    .filter((p) => p.claim && !siteMap.has(p.claim.siteCode))
    .map((p) => ({ fileName: p.fileName, siteCode: p.claim!.siteCode, error: `Site ${p.claim!.siteCode} not found` }));

  if (action === "parse") {
    return NextResponse.json({ action: "parse", claims: claimRows, parseErrors, missingSiteErrors });
  }

  // ── Upsert ──
  const results: (ClaimRow & { importStatus: "CREATED" | "UPDATED" | "ERROR"; importError?: string })[] = [];

  for (const row of claimRows) {
    const site = siteMap.get(row.siteCode)!;
    const existing = existingBySiteId.get(site.id);
    try {
      if (existing) {
        await prisma.siteClaim.update({
          where: { id: existing.id },
          data: {
            claimDate: row.claimDate,
            amountClaimed: row.amountClaimed,
            amountReceived: row.amountReceived,
            status: row.claimStatus,
          },
        });
        results.push({ ...row, importStatus: "UPDATED" });
      } else {
        await prisma.siteClaim.create({
          data: {
            siteId: site.id,
            claimDate: row.claimDate,
            amountClaimed: row.amountClaimed,
            amountReceived: row.amountReceived,
            status: row.claimStatus,
          },
        });
        results.push({ ...row, importStatus: "CREATED" });
      }
    } catch (e) {
      results.push({
        ...row,
        importStatus: "ERROR",
        importError: e instanceof Error ? e.message : "DB error",
      });
    }
  }

  return NextResponse.json({ action: "import", results, parseErrors, missingSiteErrors });
}
