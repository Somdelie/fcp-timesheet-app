import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { verifyApiToken } from "@/lib/jwt";
import { calcSiteCosts } from "@/lib/procurement";
import { prisma } from "@/lib/prisma";
import { startOfDayUTC, addDaysUTC } from "@/lib/dateUtc";
import { currentFortnightSatFri } from "@/lib/fortnight";
import { PDFDocument, StandardFonts, rgb, PageSizes } from "pdf-lib";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

async function getAuth(req: Request) {
  const h = req.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : null;
  if (token) {
    const p = await verifyApiToken(token);
    if (p && (p.role === "ADMIN" || p.role === "OFFICE"))
      return { id: p.sub, role: p.role as string };
  }
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  if (session?.user && (role === "ADMIN" || role === "OFFICE"))
    return { id: (session.user as any).id as string, role: role as string };
  return null;
}

function fmt(n: number) {
  return "R " + n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function embedLogo(pdf: PDFDocument) {
  try {
    const bytes = await readFile(path.join(process.cwd(), "public", "logo.png"));
    return await pdf.embedPng(bytes);
  } catch {
    return null;
  }
}

/**
 * GET /api/app/admin/reports/site-wages.pdf
 * Query params:
 *   from      ISO date (default: current fortnight start)
 *   to        ISO date (default: current fortnight end)
 *   min       minimum wages to include (default: 0 = all sites with wages)
 *   max       optional maximum wages to include
 *   threshold legacy alias for min
 */
export async function GET(req: Request) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });

    const url = new URL(req.url);
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const minParam = url.searchParams.get("min");
    const maxParam = url.searchParams.get("max");
    const thresholdParam = url.searchParams.get("threshold");
    const minWages = minParam
      ? parseFloat(minParam)
      : thresholdParam
        ? parseFloat(thresholdParam)
        : 0;
    const maxWages = maxParam ? parseFloat(maxParam) : null;

    let start: Date;
    let endExclusive: Date;
    let startISO: string;
    let endISO: string;

    if (fromParam && toParam) {
      start = startOfDayUTC(fromParam);
      const end = startOfDayUTC(toParam);
      endExclusive = addDaysUTC(end, 1);
      startISO = fromParam;
      endISO = toParam;
    } else {
      const ft = currentFortnightSatFri(new Date());
      start = startOfDayUTC(ft.startISO);
      const end = startOfDayUTC(ft.endISO);
      endExclusive = addDaysUTC(end, 1);
      startISO = ft.startISO;
      endISO = ft.endISO;
    }

    const result = await calcSiteCosts(start, endExclusive);
    const rows = result.rows
      .filter(
        (r) =>
          r.wagesCost > minWages &&
          (maxWages === null || r.wagesCost <= maxWages),
      )
      .sort((a, b) => b.wagesCost - a.wagesCost);

    const siteMetaRows = await prisma.site.findMany({
      where: { id: { in: rows.map((r) => r.siteId) } },
      select: {
        id: true,
        client: true,
        supervisorAssignments: {
          orderBy: { startsOn: "desc" },
          take: 1,
          select: {
            supervisor: {
              select: {
                user: { select: { name: true } },
              },
            },
          },
        },
      },
    });
    const siteMeta = new Map(
      siteMetaRows.map((site) => [
        site.id,
        {
          client: site.client,
          supervisor:
            site.supervisorAssignments[0]?.supervisor.user.name ?? null,
        },
      ]),
    );

    // ── Build PDF ──────────────────────────────────────────────
    const pdf = await PDFDocument.create();
    const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
    const regularFont = await pdf.embedFont(StandardFonts.Helvetica);
    const logo = await embedLogo(pdf);

    const PAGE_W = PageSizes.A4[0]; // 595 pt
    const PAGE_H = PageSizes.A4[1]; // 842 pt
    const MARGIN = 40;
    const COL_W = PAGE_W - MARGIN * 2;

    // Colours
    const BLACK = rgb(0.07, 0.07, 0.1);
    const DARK = rgb(0.15, 0.18, 0.41);       // FCP navy
    const GREY = rgb(0.45, 0.45, 0.5);
    const LIGHT_BG = rgb(0.96, 0.97, 0.99);
    const GREEN = rgb(0.06, 0.73, 0.51);
    const WHITE = rgb(1, 1, 1);
    const DIVIDER = rgb(0.87, 0.88, 0.91);

    // Row heights
    const ROW_H = 22;
    const HEADER_H = 28;

    let page = pdf.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - MARGIN;

    function ensureSpace(needed: number) {
      if (y - needed < MARGIN + 30) {
        page = pdf.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - MARGIN;
      }
    }

    // ── Logo + Header ──────────────────────────────────────────
    if (logo) {
      const scale = 36 / logo.height;
      page.drawImage(logo, { x: MARGIN, y: y - 36, width: logo.width * scale, height: 36 });
    }

    // Title block (right-aligned)
    const title = "Site Wages Report";
    const titleW = boldFont.widthOfTextAtSize(title, 16);
    page.drawText(title, {
      x: PAGE_W - MARGIN - titleW,
      y: y - 14,
      size: 16,
      font: boldFont,
      color: DARK,
    });

    const subtitle = `Period: ${startISO}  →  ${endISO}`;
    const subW = regularFont.widthOfTextAtSize(subtitle, 9);
    page.drawText(subtitle, {
      x: PAGE_W - MARGIN - subW,
      y: y - 28,
      size: 9,
      font: regularFont,
      color: GREY,
    });

    const generatedStr = `Generated: ${new Date().toLocaleString("en-ZA")}`;
    const genW = regularFont.widthOfTextAtSize(generatedStr, 8);
    page.drawText(generatedStr, {
      x: PAGE_W - MARGIN - genW,
      y: y - 40,
      size: 8,
      font: regularFont,
      color: GREY,
    });

    y -= 52;

    // Divider line
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 1, color: DARK });
    y -= 12;

    // Summary badge
    const totalWages = rows.reduce((s, r) => s + r.wagesCost, 0);
    const rangeLabel =
      maxWages !== null
        ? `${fmt(minWages)} - ${fmt(maxWages)}`
        : minWages > 0
          ? `above ${fmt(minWages)}`
          : "all wage totals";
    const summaryText =
      minWages > 0 || maxWages !== null
        ? `${rows.length} site${rows.length !== 1 ? "s" : ""} with wages ${rangeLabel}   |   Total: ${fmt(totalWages)}`
        : `${rows.length} site${rows.length !== 1 ? "s" : ""}   |   Total wages: ${fmt(totalWages)}`;

    page.drawRectangle({ x: MARGIN, y: y - 18, width: COL_W, height: 22, color: LIGHT_BG, borderColor: DIVIDER, borderWidth: 1 });
    page.drawText(summaryText, { x: MARGIN + 10, y: y - 11, size: 9, font: boldFont, color: DARK });
    y -= 30;

    // ── Table header ───────────────────────────────────────────
    const COL = {
      job:        { x: MARGIN,       w: 58 },
      site:       { x: MARGIN + 58,  w: 174 },
      supervisor: { x: MARGIN + 232, w: 108 },
      client:     { x: MARGIN + 340, w: 96 },
      wages:      { x: MARGIN + 436, w: COL_W - 436 },
    };

    ensureSpace(HEADER_H + ROW_H);

    page.drawRectangle({ x: MARGIN, y: y - HEADER_H, width: COL_W, height: HEADER_H, color: DARK });

    const headers: [string, { x: number; w: number }][] = [
      ["JOB NO.", COL.job],
      ["SITE NAME", COL.site],
      ["SUPERVISOR", COL.supervisor],
      ["CLIENT", COL.client],
      ["TOTAL WAGES", COL.wages],
    ];

    for (const [label, col] of headers) {
      const lw = boldFont.widthOfTextAtSize(label, 8);
      const lx = label === "TOTAL WAGES"
        ? col.x + col.w - lw - 4    // right-align numbers
        : col.x + 4;
      page.drawText(label, { x: lx, y: y - HEADER_H + 9, size: 8, font: boldFont, color: WHITE });
    }
    y -= HEADER_H;

    // ── Table rows ─────────────────────────────────────────────
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      ensureSpace(ROW_H + 4);

      const even = i % 2 === 0;
      if (even) {
        page.drawRectangle({ x: MARGIN, y: y - ROW_H, width: COL_W, height: ROW_H, color: LIGHT_BG });
      }

      const textY = y - ROW_H + 7;

      const meta = siteMeta.get(row.siteId);

      // Site name — truncate if too wide
      let siteName = row.siteName;
      while (siteName.length > 0 && boldFont.widthOfTextAtSize(siteName, 8.5) > COL.site.w - 8) {
        siteName = siteName.slice(0, -1);
      }
      if (siteName !== row.siteName) siteName = siteName.slice(0, -1) + "…";
      page.drawText(siteName, { x: COL.site.x + 4, y: textY, size: 8.5, font: boldFont, color: BLACK });

      // Job no.
      page.drawText(row.siteCode || "—", { x: COL.job.x + 4, y: textY, size: 8, font: regularFont, color: GREY });

      let supervisor = meta?.supervisor || "-";
      const origSupervisor = supervisor;
      while (supervisor.length > 1 && regularFont.widthOfTextAtSize(supervisor, 8) > COL.supervisor.w - 8) {
        supervisor = supervisor.slice(0, -1);
      }
      if (supervisor !== origSupervisor) supervisor = supervisor.slice(0, -1) + "...";
      page.drawText(supervisor, { x: COL.supervisor.x + 4, y: textY, size: 8, font: regularFont, color: GREY });

      let client = meta?.client || "-";
      const origClient = client;
      while (client.length > 1 && regularFont.widthOfTextAtSize(client, 8) > COL.client.w - 8) {
        client = client.slice(0, -1);
      }
      if (client !== origClient) client = client.slice(0, -1) + "...";
      page.drawText(client, { x: COL.client.x + 4, y: textY, size: 8, font: regularFont, color: GREY });

      // Wages — right-aligned, bold green if large
      const wagesStr = fmt(row.wagesCost);
      const wagesW = boldFont.widthOfTextAtSize(wagesStr, 9);
      const wagesColor = row.wagesCost >= 50000 ? GREEN : BLACK;
      page.drawText(wagesStr, { x: COL.wages.x + COL.wages.w - wagesW - 4, y: textY, size: 9, font: boldFont, color: wagesColor });

      // Bottom divider
      page.drawLine({
        start: { x: MARGIN, y: y - ROW_H },
        end: { x: PAGE_W - MARGIN, y: y - ROW_H },
        thickness: 0.4,
        color: DIVIDER,
      });

      y -= ROW_H;
    }

    // ── Totals row ─────────────────────────────────────────────
    ensureSpace(HEADER_H + 10);
    y -= 6;
    page.drawRectangle({ x: MARGIN, y: y - HEADER_H, width: COL_W, height: HEADER_H, color: DARK });
    page.drawText("TOTAL", { x: COL.site.x + 4, y: y - HEADER_H + 9, size: 9, font: boldFont, color: WHITE });
    const totalStr = fmt(totalWages);
    const totalW = boldFont.widthOfTextAtSize(totalStr, 11);
    page.drawText(totalStr, { x: COL.wages.x + COL.wages.w - totalW - 4, y: y - HEADER_H + 8, size: 11, font: boldFont, color: WHITE });

    // ── Page numbers ───────────────────────────────────────────
    const pages = pdf.getPages();
    const total = pages.length;
    for (let i = 0; i < total; i++) {
      const pg = pages[i];
      const pgStr = `Page ${i + 1} of ${total}`;
      const pgW = regularFont.widthOfTextAtSize(pgStr, 8);
      pg.drawText(pgStr, { x: PAGE_W - MARGIN - pgW, y: 20, size: 8, font: regularFont, color: GREY });
      pg.drawText("FCP Site Wages Report — Confidential", { x: MARGIN, y: 20, size: 8, font: regularFont, color: GREY });
    }

    const bytes = await pdf.save();
    const filename = `site-wages_${startISO}_${endISO}.pdf`;

    return new Response(Buffer.from(bytes), {
      headers: {
        ...CORS,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(bytes.length),
      },
    });
  } catch (e: any) {
    console.error("site-wages PDF error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500, headers: CORS });
  }
}
