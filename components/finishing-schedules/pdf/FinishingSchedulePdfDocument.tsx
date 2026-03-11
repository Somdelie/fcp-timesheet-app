import React from "react";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { FinishingSchedulePdfDto } from "@/lib/finishing-schedules/mapFinishingScheduleToPdfDto";
import fs from "fs";
import path from "path";

/**
 * Read the logo once at module load.
 * Works both locally (cwd = project root) and on Netlify
 * (cwd = .netlify/functions-internal, but __dirname crawls up to public).
 */
function resolveLogoDataUri(): string {
  const candidates = [
    path.join(process.cwd(), "public", "logo.png"),
    path.resolve(__dirname, "..", "..", "..", "public", "logo.png"),
    path.resolve(__dirname, "..", "public", "logo.png"),
  ];
  for (const p of candidates) {
    try {
      const buf = fs.readFileSync(p);
      return `data:image/png;base64,${buf.toString("base64")}`;
    } catch {
      /* try next */
    }
  }
  // Fallback: return empty string (Image will be skipped)
  return "";
}

const LOGO_DATA_URI = resolveLogoDataUri();

/* ------------------------------------------------------------------
 *  Styles
 * ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  page: {
    fontSize: 9,
    fontFamily: "Helvetica",
    paddingTop: 24,
    paddingBottom: 32,
    paddingHorizontal: 24,
    color: "#111111",
    lineHeight: 1.25,
  },

  /* ---- Header row ---- */
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  brandBox: { width: "28%", paddingRight: 8 },
  brandLogo: { width: 120, height: "auto" },
  brandSub: { fontSize: 8, color: "#444444", marginTop: 2 },

  titleBox: {
    width: "44%",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 2,
  },
  title: { fontSize: 16, fontWeight: 700, letterSpacing: 0.8 },

  pageNoBox: { width: "28%", alignItems: "flex-end", paddingTop: 2 },
  pageNo: { fontSize: 8, color: "#444444" },

  /* ---- Metadata ---- */
  metaRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  metaPanel: { flex: 1, border: "1 solid #666666", padding: 8, minHeight: 92 },
  metaLine: { flexDirection: "row", marginBottom: 4 },
  metaLabel: { width: "38%", fontSize: 8.5, fontWeight: 700 },
  metaValue: { width: "62%", fontSize: 8.5 },

  /* ---- Contact bar ---- */
  contactBar: {
    border: "1 solid #666666",
    borderBottom: 0,
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: "#F2F2F2",
  },
  contactText: { fontSize: 8.5, fontWeight: 700 },

  /* ---- Table ---- */
  table: { border: "1 solid #666666", marginBottom: 10 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#EDEDED",
    borderBottom: "1 solid #666666",
  },
  th: {
    fontSize: 8,
    fontWeight: 700,
    paddingVertical: 6,
    paddingHorizontal: 5,
    borderRight: "1 solid #666666",
  },
  thLast: { borderRight: 0 },

  row: {
    flexDirection: "row",
    borderBottom: "1 solid #CCCCCC",
    minHeight: 18,
  },
  rowLast: { borderBottom: 0 },
  cell: {
    fontSize: 8,
    paddingVertical: 4,
    paddingHorizontal: 5,
    borderRight: "1 solid #DDDDDD",
  },
  cellLast: { borderRight: 0 },

  /* Column widths */
  colArea: { width: "18%" },
  colZone: { width: "13%" },
  colPosition: { width: "16%" },
  colProduct: { width: "19%" },
  colColor: { width: "22%" },
  colSupplier: { width: "12%" },

  /* ---- Empty state ---- */
  emptyStateWrap: {
    paddingVertical: 28,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyStateText: { fontSize: 10, color: "#555555" },

  /* ---- Notes ---- */
  noteBlock: { border: "1 solid #666666", padding: 8 },
  noteTitle: { fontSize: 9, fontWeight: 700, marginBottom: 5 },
  noteItem: { fontSize: 8, marginBottom: 3 },

  /* ---- Footer ---- */
  footer: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: "#666666",
  },
});

/* ------------------------------------------------------------------
 *  Flat row for table rendering
 * ------------------------------------------------------------------ */

type FlatRow = {
  area: string;
  zone: string;
  position: string;
  product: string;
  colorCode: string;
  supplier: string;
  showArea: boolean;
  showZone: boolean;
};

function flattenRows(data: FinishingSchedulePdfDto): FlatRow[] {
  const rows: FlatRow[] = [];

  for (const area of data.areas) {
    let prevZone: string | null = null;

    for (let i = 0; i < area.items.length; i++) {
      const item = area.items[i];
      const isFirstInArea = i === 0;
      const zoneChanged = item.zone !== prevZone;

      rows.push({
        area: area.displayName,
        zone: item.zone,
        position: item.position,
        product: item.product,
        colorCode: item.colorCode,
        supplier: item.supplier,
        showArea: isFirstInArea,
        showZone: isFirstInArea || zoneChanged,
      });

      prevZone = item.zone;
    }
  }

  return rows;
}

/* ------------------------------------------------------------------
 *  Fixed table header (repeats on each page)
 * ------------------------------------------------------------------ */

function TableHeader() {
  return (
    <View style={styles.tableHeader} fixed>
      <Text style={[styles.th, styles.colArea]}>AREA</Text>
      <Text style={[styles.th, styles.colZone]}>INT / EXT</Text>
      <Text style={[styles.th, styles.colPosition]}>POSITION</Text>
      <Text style={[styles.th, styles.colProduct]}>PRODUCT</Text>
      <Text style={[styles.th, styles.colColor]}>COLOUR & CODE</Text>
      <Text style={[styles.th, styles.colSupplier, styles.thLast]}>
        SUPPLIER
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------
 *  Metadata panel helper
 * ------------------------------------------------------------------ */

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaLine}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------
 *  Main document
 * ------------------------------------------------------------------ */

export function FinishingSchedulePdfDocument({
  data,
}: {
  data: FinishingSchedulePdfDto;
}) {
  const rows = flattenRows(data);

  return (
    <Document title={`${data.siteName} Finishing Schedule`}>
      <Page size="A4" orientation="landscape" style={styles.page} wrap>
        {/* ---- Top row: brand / title / page no ---- */}
        <View style={styles.topRow} fixed>
          <View style={styles.brandBox}>
            {LOGO_DATA_URI ? (
              <Image src={LOGO_DATA_URI} style={styles.brandLogo} />
            ) : (
              <Text
                style={{ fontSize: 14, fontWeight: 700, letterSpacing: 0.4 }}
              >
                FIRST CLASS PROJECTS
              </Text>
            )}
            <Text style={styles.brandSub}>Finishing schedule document</Text>
          </View>
          <View style={styles.titleBox}>
            <Text style={styles.title}>{data.title}</Text>
          </View>
          <View style={styles.pageNoBox}>
            <Text
              style={styles.pageNo}
              render={({ pageNumber, totalPages }) =>
                `Page ${pageNumber} of ${totalPages}`
              }
            />
          </View>
        </View>

        {/* ---- Metadata boxes ---- */}
        <View style={styles.metaRow}>
          <View style={styles.metaPanel}>
            <MetaField label="Site" value={data.siteName} />
            <MetaField label="Contract No" value={data.contractNo} />
            <MetaField label="Site Address" value={data.siteAddress} />
            <MetaField label="FCP Contract Mgr" value={data.contractManager} />
            <MetaField label="FCP QS" value={data.fcpQs} />
            <MetaField label="FCP Foreman" value={data.siteForeman} />
          </View>
          <View style={styles.metaPanel}>
            <MetaField label="Client" value={data.client} />
            <MetaField label="Contract Manager" value={data.contractManager} />
            <MetaField label="Site Foreman" value={data.siteForeman} />
            <MetaField label="Start Date" value={data.startDate} />
            <MetaField label="Completion Date" value={data.completionDate} />
            <MetaField label="Drawing Details" value={data.drawingDetails} />
          </View>
        </View>

        {/* ---- Contact bar ---- */}
        <View style={styles.contactBar}>
          <Text style={styles.contactText}>{data.contactInfo}</Text>
        </View>

        {/* ---- Schedule table ---- */}
        <View style={styles.table}>
          <TableHeader />

          {rows.length === 0 ? (
            <View style={styles.emptyStateWrap}>
              <Text style={styles.emptyStateText}>
                No finishing schedule items added yet.
              </Text>
            </View>
          ) : (
            rows.map((row, index) => {
              const isLast = index === rows.length - 1;
              return (
                <View
                  key={`row-${index}`}
                  style={isLast ? [styles.row, styles.rowLast] : styles.row}
                  wrap={false}
                >
                  <Text style={[styles.cell, styles.colArea]}>
                    {row.showArea ? row.area : ""}
                  </Text>
                  <Text style={[styles.cell, styles.colZone]}>
                    {row.showZone ? row.zone : ""}
                  </Text>
                  <Text style={[styles.cell, styles.colPosition]}>
                    {row.position}
                  </Text>
                  <Text style={[styles.cell, styles.colProduct]}>
                    {row.product}
                  </Text>
                  <Text style={[styles.cell, styles.colColor]}>
                    {row.colorCode}
                  </Text>
                  <Text
                    style={[styles.cell, styles.colSupplier, styles.cellLast]}
                  >
                    {row.supplier}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        {/* ---- Notes ---- */}
        <View style={styles.noteBlock} wrap={false}>
          <Text style={styles.noteTitle}>Notes</Text>
          <Text style={styles.noteItem}>
            1. Colours and codes are a guideline only.
          </Text>
          <Text style={styles.noteItem}>
            2. Suppliers paint batches, tinting machines, mixing formulas,
            pollutants and age may affect colour matching.
          </Text>
          <Text style={styles.noteItem}>
            3. Repaired areas should be painted corner to corner.
          </Text>
          <Text style={styles.noteItem}>
            4. Tester pots to be purchased to confirm colour match prior to
            ordering bulk product.
          </Text>
        </View>

        {/* ---- Fixed footer ---- */}
        <View style={styles.footer} fixed>
          <Text>{data.siteName}</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
