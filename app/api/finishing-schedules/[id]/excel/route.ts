import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { verifyApiToken } from "@/lib/jwt";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";
import { getFinishingSchedulePdfData } from "@/lib/finishing-schedules/getFinishingSchedulePdfData";
import { mapFinishingScheduleToPdfDto } from "@/lib/finishing-schedules/mapFinishingScheduleToPdfDto";
import type { FinishingSchedulePdfDto } from "@/lib/finishing-schedules/mapFinishingScheduleToPdfDto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["ADMIN", "OFFICE", "SUPERVISOR"];

const COLS = ["A", "B", "C", "D", "E", "F"] as const;
type Col = (typeof COLS)[number];

const BORDER_COLOR = { argb: "FF666666" };
const thin: Partial<ExcelJS.Border> = { style: "thin", color: BORDER_COLOR };
const allBorders: Partial<ExcelJS.Borders> = {
  top: thin,
  bottom: thin,
  left: thin,
  right: thin,
};

async function getAuth(req: NextRequest) {
  const h = req.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : null;
  if (token) {
    const p = await verifyApiToken(token);
    if (p && ALLOWED_ROLES.includes(p.role)) return { id: p.sub, role: p.role };
  }
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  if (session?.user && role && ALLOWED_ROLES.includes(role))
    return { id: (session.user as any).id as string, role };
  return null;
}

function cell(ws: ExcelJS.Worksheet, col: Col, row: number) {
  return ws.getCell(`${col}${row}`);
}

function applyBorderBox(
  ws: ExcelJS.Worksheet,
  startRow: number,
  endRow: number,
  startCol: Col,
  endCol: Col,
) {
  const cols = COLS.slice(COLS.indexOf(startCol), COLS.indexOf(endCol) + 1);
  for (let r = startRow; r <= endRow; r++) {
    for (const c of cols) {
      const cl = ws.getCell(`${c}${r}`);
      cl.border = {
        top: r === startRow ? thin : undefined,
        bottom: r === endRow ? thin : undefined,
        left: c === startCol ? thin : undefined,
        right: c === endCol ? thin : undefined,
      };
    }
  }
}

function groupAreas(dto: FinishingSchedulePdfDto) {
  return dto.areas
    .filter((a) => a.items.length > 0)
    .map((area) => {
      const zones: {
        zone: string;
        items: {
          position: string;
          product: string;
          colorCode: string;
          supplier: string;
        }[];
      }[] = [];
      let cur: (typeof zones)[0] | null = null;
      for (const item of area.items) {
        if (!cur || cur.zone !== item.zone) {
          cur = { zone: item.zone, items: [] };
          zones.push(cur);
        }
        cur.items.push({
          position: item.position,
          product: item.product,
          colorCode: item.colorCode,
          supplier: item.supplier,
        });
      }
      return { name: area.displayName, zones };
    });
}

async function buildWorkbook(dto: FinishingSchedulePdfDto): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "FCP";
  wb.created = new Date();

  const ws = wb.addWorksheet("Finishing Schedule", {
    pageSetup: {
      orientation: "landscape",
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.5,
        right: 0.5,
        top: 0.5,
        bottom: 0.5,
        header: 0.3,
        footer: 0.3,
      },
    },
    views: [{ showGridLines: false }],
  });

  ws.columns = [
    { key: "A", width: 20 },
    { key: "B", width: 13 },
    { key: "C", width: 20 },
    { key: "D", width: 27 },
    { key: "E", width: 33 },
    { key: "F", width: 20 },
  ];

  let r = 1;

  /* ── Row 1: Logo / Title ─────────────────────────────────────────── */
  ws.getRow(r).height = 36;

  // Try to embed the logo image
  const logoCandidates = [
    path.join(process.cwd(), "public", "logo.png"),
    path.resolve(__dirname, "..", "..", "..", "..", "public", "logo.png"),
  ];
  let logoAdded = false;
  for (const p of logoCandidates) {
    try {
      const base64 = fs.readFileSync(p).toString("base64");
      const imageId = wb.addImage({ base64, extension: "png" });
      // @ts-expect-error ExcelJS tl/br shape differs from Anchor type definition
      ws.addImage(imageId, { tl: { col: 0, row: 0 }, br: { col: 1, row: 1 }, editAs: "oneCell" });
      logoAdded = true;
      break;
    } catch {
      /* try next */
    }
  }
  if (!logoAdded) {
    const logoCell = cell(ws, "A", r);
    logoCell.value = "FIRST CLASS PROJECTS";
    logoCell.font = { bold: true, size: 12, name: "Arial" };
    logoCell.alignment = { vertical: "middle", horizontal: "left" };
  }

  ws.mergeCells(`B${r}:E${r}`);
  const titleCell = cell(ws, "B", r);
  titleCell.value = dto.title;
  titleCell.font = { bold: true, size: 16, name: "Arial" };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };

  r++;

  /* ── Rows 2–7: Metadata panels ───────────────────────────────────── */
  const metaLeft = [
    ["Site", dto.siteName],
    ["Contract No", dto.contractNo],
    ["Site Address", dto.siteAddress],
    ["FCP Contract Mgr", dto.fcpContractManager],
    ["FCP QS", dto.fcpQs],
    ["FCP Foreman", dto.fcpSiteForeman],
  ];
  const metaRight = [
    ["Client", dto.client],
    ["Contract Manager", dto.contractManager],
    ["Site Foreman", dto.siteForeman],
    ["Start Date", dto.startDate],
    ["Completion Date", dto.completionDate],
    ["Drawing Details", dto.drawingDetails],
  ];

  const metaStart = r;
  for (let i = 0; i < 6; i++) {
    ws.getRow(r).height = 16;

    // Left panel – A label, B:C value
    ws.mergeCells(`B${r}:C${r}`);
    cell(ws, "A", r).value = metaLeft[i][0];
    cell(ws, "A", r).font = { bold: true, size: 9, name: "Arial" };
    cell(ws, "A", r).alignment = { vertical: "middle" };
    cell(ws, "B", r).value = metaLeft[i][1];
    cell(ws, "B", r).font = { size: 9, name: "Arial" };
    cell(ws, "B", r).alignment = { vertical: "middle", wrapText: true };

    // Right panel – D label, E:F value
    ws.mergeCells(`E${r}:F${r}`);
    cell(ws, "D", r).value = metaRight[i][0];
    cell(ws, "D", r).font = { bold: true, size: 9, name: "Arial" };
    cell(ws, "D", r).alignment = { vertical: "middle" };
    cell(ws, "E", r).value = metaRight[i][1];
    cell(ws, "E", r).font = { size: 9, name: "Arial" };
    cell(ws, "E", r).alignment = { vertical: "middle", wrapText: true };

    r++;
  }
  applyBorderBox(ws, metaStart, metaStart + 5, "A", "C");
  applyBorderBox(ws, metaStart, metaStart + 5, "D", "F");

  /* ── Contact bar ─────────────────────────────────────────────────── */
  ws.mergeCells(`A${r}:F${r}`);
  const contactCell = cell(ws, "A", r);
  contactCell.value = dto.contactInfo;
  contactCell.font = { bold: true, size: 9, name: "Arial" };
  contactCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  contactCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFFFFF" },
  };
  contactCell.border = {
    top: thin,
    left: thin,
    right: thin,
  };
  ws.getRow(r).height = 18;
  r++;

  /* ── Table header ────────────────────────────────────────────────── */
  ws.getRow(r).height = 20;
  (
    [
      ["A", "AREA"],
      ["B", "INT / EXT"],
      ["C", "POSITION"],
      ["D", "PRODUCT"],
      ["E", "COLOUR & CODE"],
      ["F", "SUPPLIER"],
    ] as [Col, string][]
  ).forEach(([c, label]) => {
    const cl = cell(ws, c, r);
    cl.value = label;
    cl.font = { bold: true, size: 8, name: "Arial" };
    cl.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDEDED" } };
    cl.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    cl.border = allBorders;
  });
  r++;

  /* ── Data rows ───────────────────────────────────────────────────── */
  const areas = groupAreas(dto);

  if (areas.length === 0) {
    ws.mergeCells(`A${r}:F${r}`);
    const emptyCell = cell(ws, "A", r);
    emptyCell.value = "No finishing schedule items added yet.";
    emptyCell.alignment = { horizontal: "center", vertical: "middle" };
    emptyCell.border = allBorders;
    ws.getRow(r).height = 40;
    r++;
  } else {
    for (const area of areas) {
      const areaStart = r;
      const totalAreaRows = area.zones.reduce((s, z) => s + z.items.length, 0);

      for (let zi = 0; zi < area.zones.length; zi++) {
        const zone = area.zones[zi];
        const zoneStart = r;

        for (let ii = 0; ii < zone.items.length; ii++) {
          const item = zone.items[ii];
          ws.getRow(r).height = 18;

          // A – area (value only on first row; merged below)
          const aCell = cell(ws, "A", r);
          if (zi === 0 && ii === 0) {
            aCell.value = area.name;
            aCell.font = { bold: true, size: 8, name: "Arial" };
          }
          aCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF0F0F0" },
          };
          aCell.alignment = {
            vertical: "middle",
            horizontal: "left",
            indent: 1,
            wrapText: true,
          };
          aCell.border = {
            top: r === areaStart ? thin : undefined,
            bottom: r === areaStart + totalAreaRows - 1 ? thin : undefined,
            left: thin,
            right: thin,
          };

          // B – zone (value only on first row of zone; merged below)
          const bCell = cell(ws, "B", r);
          if (ii === 0) {
            bCell.value = zone.zone;
            bCell.font = { size: 8, name: "Arial" };
          }
          bCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF5F5F5" },
          };
          bCell.alignment = {
            vertical: "middle",
            horizontal: "left",
            indent: 1,
            wrapText: true,
          };
          bCell.border = {
            top: r === zoneStart ? thin : undefined,
            bottom: r === zoneStart + zone.items.length - 1 ? thin : undefined,
            left: thin,
            right: thin,
          };

          // C–F item data
          (
            [
              ["C", item.position],
              ["D", item.product],
              ["E", item.colorCode],
              ["F", item.supplier],
            ] as [Col, string][]
          ).forEach(([c, val]) => {
            const cl = cell(ws, c, r);
            cl.value = val;
            cl.font = { size: 8, name: "Arial" };
            cl.alignment = { vertical: "middle", indent: 1, wrapText: true };
            cl.border = allBorders;
          });

          r++;
        }

        // Merge zone cells (col B)
        if (zone.items.length > 1) {
          ws.mergeCells(`B${zoneStart}:B${zoneStart + zone.items.length - 1}`);
          // Re-apply style on merged cell (top-left)
          const merged = cell(ws, "B", zoneStart);
          merged.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF5F5F5" },
          };
          merged.alignment = {
            vertical: "middle",
            horizontal: "left",
            indent: 1,
          };
        }
      }

      // Merge area cells (col A)
      if (totalAreaRows > 1) {
        ws.mergeCells(`A${areaStart}:A${areaStart + totalAreaRows - 1}`);
        const merged = cell(ws, "A", areaStart);
        merged.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF0F0F0" },
        };
        merged.alignment = {
          vertical: "middle",
          horizontal: "left",
          indent: 1,
        };
        merged.font = { bold: true, size: 8, name: "Arial" };
      }
    }
  }

  /* ── Notes ───────────────────────────────────────────────────────── */
  r++; // blank spacer row
  const notesStart = r;
  const noteLines = [
    "Notes",
    "1. Colours and codes are a guideline only.",
    "2. Suppliers paint batches, tinting machines, mixing formulas, pollutants and age may affect colour matching.",
    "3. Repaired areas should be painted corner to corner.",
    "4. Tester pots to be purchased to confirm colour match prior to ordering bulk product.",
  ];
  noteLines.forEach((line, i) => {
    ws.mergeCells(`A${r}:F${r}`);
    const cl = cell(ws, "A", r);
    cl.value = line;
    cl.font =
      i === 0
        ? { bold: true, size: 9, name: "Arial" }
        : { size: 8, name: "Arial" };
    cl.alignment = { vertical: "middle", indent: 1, wrapText: true };
    cl.border = {
      top: r === notesStart ? thin : undefined,
      bottom: r === notesStart + noteLines.length - 1 ? thin : undefined,
      left: thin,
      right: thin,
    };
    ws.getRow(r).height = i === 0 ? 16 : 14;
    r++;
  });

  /* ── Print header/footer ─────────────────────────────────────────── */
  ws.headerFooter = {
    oddHeader: `&L${dto.siteName}&C${dto.title}&R&P of &N`,
    oddFooter: "",
  };

  return wb;
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  const auth = await getAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });
  }

  const { id } = await params;
  const schedule = await getFinishingSchedulePdfData(id);
  if (!schedule) {
    return NextResponse.json(
      { error: "Finishing schedule not found" },
      { status: 404, headers: CORS },
    );
  }

  const dto = mapFinishingScheduleToPdfDto(schedule);
  const wb = await buildWorkbook(dto);

  const buffer = await wb.xlsx.writeBuffer();

  const safeSite = dto.siteName
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .replace(/\s+/g, "_")
    .substring(0, 60);
  const safeContract = dto.contractNo.replace(/[^a-zA-Z0-9-]/g, "");
  const filename = `Finishing_Schedule_${safeSite}_${safeContract}.xlsx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      ...CORS,
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
