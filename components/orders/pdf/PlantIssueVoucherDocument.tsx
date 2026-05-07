import React from "react";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
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
    } catch { /* try next */ }
  }
  return "";
}

const LOGO_DATA_URI = resolveLogoDataUri();
const BORDER = "1 solid #666666";

export interface PlantIssueVoucherSite {
  siteName: string;
  siteCode?: string | null;
  items: { productName: string; quantity: number; note?: string }[];
}

export interface PlantIssueVoucherData {
  orderNumber: string;
  issuedDate: string;
  supervisorName: string;
  issuedBy?: string | null;
  /** Multi-site: pass one entry per site. Single-site: array with one entry. */
  sites: PlantIssueVoucherSite[];
}

const styles = StyleSheet.create({
  page: {
    fontSize: 9,
    fontFamily: "Helvetica",
    paddingTop: 24,
    paddingBottom: 52,
    paddingHorizontal: 28,
    color: "#111111",
    lineHeight: 1.25,
  },

  /* ---- Header ---- */
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
    borderBottom: BORDER,
    paddingBottom: 12,
  },
  brandBox: { width: "30%", paddingRight: 8 },
  brandLogo: { width: 120, height: "auto" },
  brandFallback: { fontSize: 13, fontWeight: 700, letterSpacing: 0.3 },
  titleBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  subtitle: { fontSize: 8, color: "#666666", marginTop: 3, letterSpacing: 0.3 },
  orderBox: { width: "30%", alignItems: "flex-end", paddingTop: 2 },
  orderLabel: {
    fontSize: 7.5,
    color: "#777777",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  orderValue: { fontSize: 11, fontWeight: 700, marginTop: 2 },
  dateValue: { fontSize: 8, color: "#555555", marginTop: 3 },

  /* ---- Meta ---- */
  metaRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  metaPanel: { flex: 1, border: BORDER, padding: 8 },
  metaPanelTitle: {
    fontSize: 7.5,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: "#777777",
    marginBottom: 6,
    borderBottom: "1 solid #DDDDDD",
    paddingBottom: 4,
  },
  metaLine: { flexDirection: "row", marginBottom: 4 },
  metaLabel: { width: "40%", fontSize: 8.5, fontWeight: 700 },
  metaValue: { width: "60%", fontSize: 8.5 },

  /* ---- Site section header (multi-site) ---- */
  siteSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2B2B2B",
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginTop: 10,
    marginBottom: 0,
  },
  siteSectionLabel: {
    fontSize: 8,
    fontWeight: 700,
    color: "#FFFFFF",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    flex: 1,
  },
  siteSectionCode: {
    fontSize: 7.5,
    color: "#AAAAAA",
    letterSpacing: 0.3,
  },

  /* ---- Table ---- */
  table: { border: BORDER, marginBottom: 14 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#2B2B2B",
    borderBottom: BORDER,
  },
  th: {
    fontSize: 7.5,
    fontWeight: 700,
    paddingVertical: 6,
    paddingHorizontal: 6,
    color: "#FFFFFF",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  row: { flexDirection: "row", minHeight: 22 },
  rowAlt: { backgroundColor: "#F7F7F7" },
  td: { fontSize: 8.5, paddingVertical: 5, paddingHorizontal: 6 },
  vDivider: { width: 1, backgroundColor: "#CCCCCC", alignSelf: "stretch" },
  rowDivider: { height: 1, backgroundColor: "#EEEEEE" },
  totalRow: {
    flexDirection: "row",
    borderTop: BORDER,
    backgroundColor: "#EDEDED",
  },

  /* ---- Signature section ---- */
  sigRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  sigBox: { flex: 1, border: BORDER, padding: 10 },
  sigTitle: {
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 10,
    borderBottom: "1 solid #DDDDDD",
    paddingBottom: 5,
    color: "#333333",
  },
  sigField: { marginBottom: 11 },
  sigLabel: { fontSize: 7.5, color: "#666666", marginBottom: 3 },
  sigLine: { borderBottom: "1 solid #999999", height: 14 },
  sigLineWide: { borderBottom: "1 solid #999999", height: 26 },

  /* ---- Disclaimer ---- */
  disclaimer: {
    border: BORDER,
    padding: 8,
    marginBottom: 12,
    backgroundColor: "#FAFAFA",
  },
  disclaimerText: { fontSize: 7.5, color: "#555555", lineHeight: 1.5 },

  /* ---- Footer ---- */
  footer: {
    position: "absolute",
    left: 28,
    right: 28,
    bottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: "#888888",
    borderTop: "1 solid #CCCCCC",
    paddingTop: 5,
  },
});

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaLine}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value || "—"}</Text>
    </View>
  );
}

function SiteItemsTable({ site, startIndex }: { site: PlantIssueVoucherSite; startIndex: number }) {
  const totalUnits = site.items.reduce((s, i) => s + i.quantity, 0);
  return (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        <Text style={[styles.th, { width: "6%", textAlign: "center" }]}>No.</Text>
        <View style={styles.vDivider} />
        <Text style={[styles.th, { flex: 1 }]}>Item Description</Text>
        <View style={styles.vDivider} />
        <Text style={[styles.th, { width: "12%", textAlign: "center" }]}>Qty</Text>
        <View style={styles.vDivider} />
        <Text style={[styles.th, { width: "32%" }]}>Notes / Condition</Text>
      </View>

      {site.items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && <View style={styles.rowDivider} />}
          <View style={[styles.row, i % 2 === 1 ? styles.rowAlt : {}]} wrap={false}>
            <Text style={[styles.td, { width: "6%", textAlign: "center", color: "#999999" }]}>
              {startIndex + i + 1}
            </Text>
            <View style={styles.vDivider} />
            <Text style={[styles.td, { flex: 1, fontWeight: 700 }]}>{item.productName}</Text>
            <View style={styles.vDivider} />
            <Text style={[styles.td, { width: "12%", textAlign: "center", fontWeight: 700 }]}>
              {item.quantity}
            </Text>
            <View style={styles.vDivider} />
            <Text style={[styles.td, { width: "32%", color: "#555555" }]}>{item.note ?? ""}</Text>
          </View>
        </React.Fragment>
      ))}

      {/* Total row */}
      <View style={styles.totalRow} wrap={false}>
        <Text style={[styles.td, { width: "6%", textAlign: "center" }]} />
        <View style={styles.vDivider} />
        <Text style={[styles.td, { flex: 1, fontWeight: 700, fontSize: 8, textTransform: "uppercase", letterSpacing: 0.3 }]}>
          Site Total
        </Text>
        <View style={styles.vDivider} />
        <Text style={[styles.td, { width: "12%", textAlign: "center", fontWeight: 700 }]}>
          {totalUnits}
        </Text>
        <View style={styles.vDivider} />
        <Text style={[styles.td, { width: "32%" }]} />
      </View>
    </View>
  );
}

export function PlantIssueVoucherDocument({ data }: { data: PlantIssueVoucherData }) {
  const grandTotal = data.sites.reduce(
    (acc, s) => acc + s.items.reduce((sum, i) => sum + i.quantity, 0),
    0,
  );
  const isMultiSite = data.sites.length > 1;

  return (
    <Document title={`Plant Issue Order ${data.orderNumber}`}>
      <Page size="A4" style={styles.page}>
        {/* ---- Header ---- */}
        <View style={styles.topRow}>
          <View style={styles.brandBox}>
            {LOGO_DATA_URI ? (
              <Image src={LOGO_DATA_URI} style={styles.brandLogo} />
            ) : (
              <Text style={styles.brandFallback}>FIRST CLASS PROJECTS</Text>
            )}
          </View>
          <View style={styles.titleBox}>
            <Text style={styles.title}>Plant Issue Order</Text>
            <Text style={styles.subtitle}>Plant &amp; Equipment Issue Record</Text>
          </View>
          <View style={styles.orderBox}>
            <Text style={styles.orderLabel}>Order Number</Text>
            <Text style={styles.orderValue}>{data.orderNumber}</Text>
            <Text style={styles.dateValue}>{data.issuedDate}</Text>
          </View>
        </View>

        {/* ---- Meta panels ---- */}
        <View style={styles.metaRow}>
          <View style={styles.metaPanel}>
            <Text style={styles.metaPanelTitle}>
              {isMultiSite ? "Deployment Details" : "Site Details"}
            </Text>
            {isMultiSite ? (
              <>
                <MetaField
                  label="Sites"
                  value={data.sites
                    .map((s) => (s.siteCode ? `${s.siteCode} – ${s.siteName}` : s.siteName))
                    .join(", ")}
                />
                <MetaField label="Issued To" value={data.supervisorName} />
              </>
            ) : (
              <>
                <MetaField label="Site Name" value={data.sites[0]?.siteName ?? "—"} />
                {data.sites[0]?.siteCode && (
                  <MetaField label="Site Code" value={data.sites[0].siteCode} />
                )}
                <MetaField label="Issued To" value={data.supervisorName} />
              </>
            )}
          </View>
          <View style={styles.metaPanel}>
            <Text style={styles.metaPanelTitle}>Order Details</Text>
            <MetaField label="Order No." value={data.orderNumber} />
            <MetaField label="Date Issued" value={data.issuedDate} />
            {data.issuedBy && <MetaField label="Issued By" value={data.issuedBy} />}
            <MetaField label="Total Units" value={String(grandTotal)} />
            {isMultiSite && (
              <MetaField label="No. of Sites" value={String(data.sites.length)} />
            )}
          </View>
        </View>

        {/* ---- Items: per-site sections ---- */}
        {data.sites.map((site, sIdx) => {
          const prevCount = data.sites
            .slice(0, sIdx)
            .reduce((sum, s) => sum + s.items.length, 0);
          return (
            <React.Fragment key={sIdx}>
              {isMultiSite && (
                <View style={styles.siteSectionHeader} wrap={false}>
                  <Text style={styles.siteSectionLabel}>
                    {site.siteCode ? `${site.siteCode} – ${site.siteName}` : site.siteName}
                  </Text>
                  <Text style={styles.siteSectionCode}>
                    {site.items.reduce((s, i) => s + i.quantity, 0)} units
                  </Text>
                </View>
              )}
              <SiteItemsTable site={site} startIndex={isMultiSite ? prevCount : 0} />
            </React.Fragment>
          );
        })}

        {/* Grand total row if multi-site */}
        {isMultiSite && (
          <View style={[styles.totalRow, { border: BORDER, marginBottom: 14 }]} wrap={false}>
            <Text style={[styles.td, { width: "6%", textAlign: "center" }]} />
            <View style={styles.vDivider} />
            <Text style={[styles.td, { flex: 1, fontWeight: 700, fontSize: 8.5, textTransform: "uppercase", letterSpacing: 0.3 }]}>
              Grand Total — All Sites
            </Text>
            <View style={styles.vDivider} />
            <Text style={[styles.td, { width: "12%", textAlign: "center", fontWeight: 700, fontSize: 10 }]}>
              {grandTotal}
            </Text>
            <View style={styles.vDivider} />
            <Text style={[styles.td, { width: "32%" }]} />
          </View>
        )}

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* ---- Disclaimer ---- */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            By signing this document, the recipient confirms that all items listed above have been
            received in good condition and accepts full responsibility for their safekeeping. All
            plant and equipment must be returned in the same condition upon completion of works. Any
            loss or damage must be reported immediately to the site supervisor.
          </Text>
        </View>

        {/* ---- Signatures ---- */}
        <View style={styles.sigRow} wrap={false}>
          <View style={styles.sigBox}>
            <Text style={styles.sigTitle}>Received By</Text>
            <View style={styles.sigField}>
              <Text style={styles.sigLabel}>Full Name</Text>
              <View style={styles.sigLine} />
            </View>
            <View style={styles.sigField}>
              <Text style={styles.sigLabel}>Signature</Text>
              <View style={styles.sigLineWide} />
            </View>
            <View style={styles.sigField}>
              <Text style={styles.sigLabel}>Date</Text>
              <View style={styles.sigLine} />
            </View>
          </View>
          <View style={styles.sigBox}>
            <Text style={styles.sigTitle}>Issued By</Text>
            <View style={styles.sigField}>
              <Text style={styles.sigLabel}>Full Name</Text>
              <View style={styles.sigLine} />
            </View>
            <View style={styles.sigField}>
              <Text style={styles.sigLabel}>Signature</Text>
              <View style={styles.sigLineWide} />
            </View>
            <View style={styles.sigField}>
              <Text style={styles.sigLabel}>Date</Text>
              <View style={styles.sigLine} />
            </View>
          </View>
        </View>

        {/* ---- Footer ---- */}
        <View style={styles.footer} fixed>
          <Text>First Class Projects (Pty) Ltd</Text>
          <Text>{data.orderNumber} — Plant Issue Order</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
