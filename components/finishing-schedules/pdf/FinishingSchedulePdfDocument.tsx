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
  return "";
}

const LOGO_DATA_URI = resolveLogoDataUri();

/* ------------------------------------------------------------------
 *  Single border colour used everywhere
 * ------------------------------------------------------------------ */
const BORDER = "1 solid #666666";

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
  metaPanel: { flex: 1, border: BORDER, padding: 8, minHeight: 92 },
  metaLine: { flexDirection: "row", marginBottom: 4 },
  metaLabel: { width: "38%", fontSize: 8.5, fontWeight: 700 },
  metaValue: { width: "62%", fontSize: 8.5 },

  /* ---- Contact bar ---- */
  contactBar: {
    border: BORDER,
    borderBottom: 0,
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: "#F2F2F2",
  },
  contactText: { fontSize: 8.5, fontWeight: 700 },

  /* ---- Table ---- */
  table: {
    border: BORDER,
    borderTop: 0,
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#EDEDED",
    borderTop: BORDER,
    borderBottom: BORDER,
  },
  th: {
    fontSize: 8,
    fontWeight: 700,
    paddingVertical: 6,
    paddingHorizontal: 5,
  },

  /* ---- Empty state ---- */
  emptyStateWrap: {
    paddingVertical: 28,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyStateText: { fontSize: 10, color: "#555555" },

  /* ---- Notes ---- */
  noteBlock: { border: BORDER, padding: 8 },
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
 *  Column widths - simplified percentage-based layout for proper alignment
 *  Total: 100% distributed across columns
 * ------------------------------------------------------------------ */
const COL_AREA = "15%";
const COL_ZONE = "10%";
const COL_POS = "15%";
const COL_PROD = "20%";
const COL_CLR = "25%";
const COL_SUP = "15%";

/* ------------------------------------------------------------------
 *  Group data by area → zone
 * ------------------------------------------------------------------ */

type ZoneGroupRow = {
  position: string;
  product: string;
  colorCode: string;
  supplier: string;
};

type ZoneGroup = {
  zone: string;
  items: ZoneGroupRow[];
};

type AreaGroup = {
  name: string;
  zones: ZoneGroup[];
};

function groupByArea(data: FinishingSchedulePdfDto): AreaGroup[] {
  return data.areas
    .filter((a) => a.items.length > 0)
    .map((area) => {
      const zones: ZoneGroup[] = [];
      let current: ZoneGroup | null = null;

      for (const item of area.items) {
        if (!current || current.zone !== item.zone) {
          current = { zone: item.zone, items: [] };
          zones.push(current);
        }
        current.items.push({
          position: item.position,
          product: item.product,
          colorCode: item.colorCode,
          supplier: item.supplier,
        });
      }

      return { name: area.displayName, zones };
    });
}

/* ------------------------------------------------------------------
 *  Table header (repeats on each page)
 * ------------------------------------------------------------------ */

function TableHeader() {
  return (
    <View style={styles.tableHeader} fixed>
      <Text style={[styles.th, { width: COL_AREA, borderRight: BORDER }]}>
        AREA
      </Text>
      <Text style={[styles.th, { width: COL_ZONE, borderRight: BORDER }]}>
        INT / EXT
      </Text>
      <Text style={[styles.th, { width: COL_POS, borderRight: BORDER }]}>
        POSITION
      </Text>
      <Text style={[styles.th, { width: COL_PROD, borderRight: BORDER }]}>
        PRODUCT
      </Text>
      <Text style={[styles.th, { width: COL_CLR, borderRight: BORDER }]}>
        COLOUR & CODE
      </Text>
      <Text style={[styles.th, { width: COL_SUP }]}>SUPPLIER</Text>
    </View>
  );
}

/* ------------------------------------------------------------------
 *  Metadata helper
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
  const areaGroups = groupByArea(data);

  return (
    <Document title={`${data.siteName} Finishing Schedule`}>
      <Page size="A4" orientation="landscape" style={styles.page} wrap>
        {/* ---- Top row ---- */}
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

          {areaGroups.length === 0 ? (
            <View style={styles.emptyStateWrap}>
              <Text style={styles.emptyStateText}>
                No finishing schedule items added yet.
              </Text>
            </View>
          ) : (
            areaGroups.map((area, ai) =>
              area.zones.map((zone, zi) =>
                zone.items.map((item, ii) => {
                  const isFirstItemInArea = zi === 0 && ii === 0;
                  const isFirstItemInZone = ii === 0;
                  const isLastRow =
                    ai === areaGroups.length - 1 &&
                    zi === area.zones.length - 1 &&
                    ii === zone.items.length - 1;

                  return (
                    <View
                      key={`${ai}-${zi}-${ii}`}
                      style={{
                        flexDirection: "row",
                        borderBottom: isLastRow ? undefined : BORDER,
                        minHeight: 18,
                      }}
                      wrap={false}
                    >
                      {/* AREA - only show on first item of area */}
                      <Text
                        style={{
                          width: COL_AREA,
                          fontSize: 8,
                          fontWeight: 700,
                          paddingVertical: 4,
                          paddingHorizontal: 5,
                          borderRight: BORDER,
                          backgroundColor: "#F0F0F0",
                        }}
                      >
                        {isFirstItemInArea ? area.name : ""}
                      </Text>
                      {/* INT / EXT - only show on first item of zone */}
                      <Text
                        style={{
                          width: COL_ZONE,
                          fontSize: 8,
                          paddingVertical: 4,
                          paddingHorizontal: 5,
                          borderRight: BORDER,
                          backgroundColor: "#F5F5F5",
                        }}
                      >
                        {isFirstItemInZone ? zone.zone : ""}
                      </Text>
                      {/* POSITION */}
                      <Text
                        style={{
                          width: COL_POS,
                          fontSize: 8,
                          paddingVertical: 4,
                          paddingHorizontal: 5,
                          borderRight: BORDER,
                        }}
                      >
                        {item.position}
                      </Text>
                      {/* PRODUCT */}
                      <Text
                        style={{
                          width: COL_PROD,
                          fontSize: 8,
                          paddingVertical: 4,
                          paddingHorizontal: 5,
                          borderRight: BORDER,
                        }}
                      >
                        {item.product}
                      </Text>
                      {/* COLOUR & CODE */}
                      <Text
                        style={{
                          width: COL_CLR,
                          fontSize: 8,
                          paddingVertical: 4,
                          paddingHorizontal: 5,
                          borderRight: BORDER,
                        }}
                      >
                        {item.colorCode}
                      </Text>
                      {/* SUPPLIER */}
                      <Text
                        style={{
                          width: COL_SUP,
                          fontSize: 8,
                          paddingVertical: 4,
                          paddingHorizontal: 5,
                        }}
                      >
                        {item.supplier}
                      </Text>
                    </View>
                  );
                }),
              ),
            )
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
