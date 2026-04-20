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
  title: { fontSize: 16, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase" },

  pageNoBox: { width: "28%", alignItems: "flex-end", paddingTop: 2 },
  pageNo: { fontSize: 8, color: "#444444" },

  /* ---- Metadata ---- */
  metaRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  metaPanel: { flex: 1, border: BORDER, padding: 8, minHeight: 92 },
  metaLine: { flexDirection: "row", marginBottom: 4 },
  metaLabel: { width: "38%", fontSize: 8.5, fontWeight: 700 },
  metaValue: { width: "62%", fontSize: 8.5, textTransform: "uppercase" },

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

  /* ---- 1-px vertical column divider ---- */
  vDivider: { width: 1, backgroundColor: "#666666", alignSelf: "stretch" },

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
 *  Column widths
 *
 *  Target visual widths (% of full row):
 *    AREA 15 | ZONE 10 | POS 15 | PROD 20 | CLR 25 | SUP 15
 *
 *  The nested flex structure means inner containers have smaller
 *  reference widths, so we compute relative percentages:
 *
 *  zones container  = 100% - 15% AREA       = 85% of full
 *  COL_ZONE_IN_CTR  = 10 / 85 * 100         ≈ 11.76% of zones
 *  items container  = 85% - 11.76%          ≈ 75% of full
 *  COL_POS_IN_CTR   = 15 / 75 * 100         = 20%   of items
 *  COL_PROD_IN_CTR  = 20 / 75 * 100         ≈ 26.67% of items
 *  COL_CLR_IN_CTR   = 25 / 75 * 100         ≈ 33.33% of items
 *  COL_SUP_IN_CTR   = 15 / 75 * 100         = 20%   of items
 * ------------------------------------------------------------------ */
const COL_AREA = "15%";

// Inside zones container (85% of full)
const COL_ZONE_IN_CTR = `${((10 / 85) * 100).toFixed(2)}%`;

// Inside items container (75% of full)
const COL_POS_IN_CTR  = `${((15 / 75) * 100).toFixed(2)}%`;
const COL_PROD_IN_CTR = `${((20 / 75) * 100).toFixed(2)}%`;
const COL_CLR_IN_CTR  = `${((25 / 75) * 100).toFixed(2)}%`;
// Supplier uses flex:1 for the remainder

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
      <Text style={[styles.th, { width: COL_AREA }]}>AREA</Text>
      <View style={styles.vDivider} />
      {/* zones container mirrors body layout */}
      <View style={{ flex: 1, flexDirection: "row" }}>
        <Text style={[styles.th, { width: COL_ZONE_IN_CTR }]}>INT / EXT</Text>
        <View style={styles.vDivider} />
        {/* items container mirrors body layout */}
        <View style={{ flex: 1, flexDirection: "row" }}>
          <Text style={[styles.th, { width: COL_POS_IN_CTR }]}>POSITION</Text>
          <View style={styles.vDivider} />
          <Text style={[styles.th, { width: COL_PROD_IN_CTR }]}>PRODUCT</Text>
          <View style={styles.vDivider} />
          <Text style={[styles.th, { width: COL_CLR_IN_CTR }]}>COLOUR & CODE</Text>
          <View style={styles.vDivider} />
          <Text style={[styles.th, { flex: 1 }]}>SUPPLIER</Text>
        </View>
      </View>
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
            areaGroups.map((area, ai) => (
              <View
                key={`area-${ai}`}
                style={{
                  flexDirection: "row",
                  borderBottom: ai < areaGroups.length - 1 ? BORDER : undefined,
                }}
              >
                {/* AREA cell — vertically centered, spans all child rows */}
                <View
                  style={{
                    width: COL_AREA,
                    justifyContent: "center",
                    paddingHorizontal: 5,
                    paddingVertical: 4,
                    backgroundColor: "#F0F0F0",
                  }}
                >
                  <Text style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase" }}>{area.name}</Text>
                </View>
                <View style={styles.vDivider} />

                {/* Zones container */}
                <View style={{ flex: 1 }}>
                  {area.zones.map((zone, zi) => (
                    <View
                      key={`zone-${zi}`}
                      style={{
                        flexDirection: "row",
                        borderBottom: zi < area.zones.length - 1 ? BORDER : undefined,
                      }}
                    >
                      {/* INT/EXT cell — vertically centered, spans all zone items */}
                      <View
                        style={{
                          width: COL_ZONE_IN_CTR,
                          justifyContent: "center",
                          paddingHorizontal: 5,
                          paddingVertical: 4,
                          backgroundColor: "#F5F5F5",
                        }}
                      >
                        <Text style={{ fontSize: 8 }}>{zone.zone}</Text>
                      </View>
                      <View style={styles.vDivider} />

                      {/* Item rows */}
                      <View style={{ flex: 1 }}>
                        {zone.items.map((item, ii) => (
                          <View
                            key={`item-${ii}`}
                            style={{
                              flexDirection: "row",
                              borderBottom: ii < zone.items.length - 1 ? BORDER : undefined,
                              minHeight: 18,
                            }}
                            wrap={false}
                          >
                            <Text style={{ width: COL_POS_IN_CTR, fontSize: 8, paddingVertical: 4, paddingHorizontal: 5 }}>
                              {item.position}
                            </Text>
                            <View style={styles.vDivider} />
                            <Text style={{ width: COL_PROD_IN_CTR, fontSize: 8, paddingVertical: 4, paddingHorizontal: 5 }}>
                              {item.product}
                            </Text>
                            <View style={styles.vDivider} />
                            <Text style={{ width: COL_CLR_IN_CTR, fontSize: 8, paddingVertical: 4, paddingHorizontal: 5 }}>
                              {item.colorCode}
                            </Text>
                            <View style={styles.vDivider} />
                            <Text style={{ flex: 1, fontSize: 8, paddingVertical: 4, paddingHorizontal: 5 }}>
                              {item.supplier}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Spacer pushes notes to bottom */}
        <View style={{ flex: 1 }} />

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
