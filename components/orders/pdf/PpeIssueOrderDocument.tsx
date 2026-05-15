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
    } catch {
      /* try next */
    }
  }
  return "";
}

const LOGO_DATA_URI = resolveLogoDataUri();
const BORDER = "1 solid #666666";

export type PpeIssueItem = {
  productName: string;
  size?: string | null;
  color?: string | null;
  quantity: number;
  unitPrice?: number | null;
  deductible?: boolean;
  note?: string | null;
};

export interface PpeIssueVoucherForeman {
  foremanName: string;
  siteName?: string | null;
  siteCode?: string | null;
  chargeToSite?: boolean;
  items: PpeIssueItem[];
}

export interface PpeIssueVoucherData {
  orderNumber: string;
  issuedDate: string;
  supervisorName: string;
  issuedBy?: string | null;
  /** Multi-foreman: one entry per foreman. Single: array with one entry. */
  foremen: PpeIssueVoucherForeman[];
}

export interface PpeIssueOrderData {
  orderNumber: string;
  issuedDate: string;
  foremanName: string;
  siteName?: string | null;
  siteCode?: string | null;
  issuedBy?: string | null;
  chargeToSite?: boolean;
  items: PpeIssueItem[];
}

/** @deprecated Use PpeIssueVoucherData with `foremen` */
export interface PpeMultiOrderData {
  orderNumber: string;
  issuedDate: string;
  supervisorName: string;
  orders: {
    foremanName: string;
    siteName?: string | null;
    siteCode?: string | null;
    chargeToSite?: boolean;
    items: PpeIssueItem[];
  }[];
}

const styles = StyleSheet.create({
  page: {
    fontSize: 9,
    fontFamily: "Helvetica",
    paddingTop: 52,
    paddingBottom: 68,
    paddingHorizontal: 42,
    color: "#111111",
    lineHeight: 1.25,
    position: "relative",
  },
  pageBorderOuter: {
    position: "absolute",
    top: 18,
    left: 20,
    right: 20,
    bottom: 18,
    border: "1 solid #2F3B59",
  },
  pageBorderMiddle: {
    position: "absolute",
    top: 22,
    left: 24,
    right: 24,
    bottom: 22,
    border: "3 solid #2F3B59",
  },
  pageBorderInner: {
    position: "absolute",
    top: 28,
    left: 30,
    right: 30,
    bottom: 28,
    border: "1 solid #2F3B59",
  },
  box: {
    flex: 1,
    paddingTop: 14,
    paddingBottom: 50,
    paddingHorizontal: 10,
  },
  watermark: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    transform: "rotate(-35deg)",
  },
  watermarkText: {
    fontSize: 88,
    fontFamily: "Helvetica-Bold",
    color: "#2F3B59",
    opacity: 0.07,
    letterSpacing: 8,
    textTransform: "uppercase",
  },
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
  foremanSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2B2B2B",
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginTop: 10,
    marginBottom: 0,
  },
  foremanSectionLabel: {
    fontSize: 8,
    fontWeight: 700,
    color: "#FFFFFF",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    flex: 1,
  },
  foremanSectionMeta: {
    fontSize: 7.5,
    color: "#AAAAAA",
    letterSpacing: 0.3,
  },
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
  disclaimer: {
    border: BORDER,
    padding: 8,
    marginBottom: 12,
    backgroundColor: "#FAFAFA",
  },
  disclaimerText: { fontSize: 7.5, color: "#555555", lineHeight: 1.5 },
  footer: {
    position: "absolute",
    left: 40,
    right: 40,
    bottom: 28,
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

function foremanSectionLabel(foreman: PpeIssueVoucherForeman): string {
  const site =
    foreman.siteCode && foreman.siteName
      ? `${foreman.siteCode} – ${foreman.siteName}`
      : foreman.siteName || foreman.siteCode || "";
  return site ? `${foreman.foremanName} (${site})` : foreman.foremanName;
}

function foremanDeductionTotal(foreman: PpeIssueVoucherForeman): number {
  return foreman.items
    .filter((i) => i.deductible !== false && i.unitPrice)
    .reduce((s, i) => s + (i.unitPrice ?? 0) * i.quantity, 0);
}

function ForemanItemsTable({
  foreman,
  startIndex,
}: {
  foreman: PpeIssueVoucherForeman;
  startIndex: number;
}) {
  const totalUnits = foreman.items.reduce((s, i) => s + i.quantity, 0);
  const totalDeduction = foremanDeductionTotal(foreman);

  return (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        <Text style={[styles.th, { width: "6%", textAlign: "center" }]}>No.</Text>
        <View style={styles.vDivider} />
        <Text style={[styles.th, { flex: 1 }]}>Item Description</Text>
        <View style={styles.vDivider} />
        <Text style={[styles.th, { width: "10%", textAlign: "center" }]}>Size</Text>
        <View style={styles.vDivider} />
        <Text style={[styles.th, { width: "10%", textAlign: "center" }]}>Color</Text>
        <View style={styles.vDivider} />
        <Text style={[styles.th, { width: "8%", textAlign: "center" }]}>Qty</Text>
        <View style={styles.vDivider} />
        <Text style={[styles.th, { width: "12%", textAlign: "right" }]}>Unit Price</Text>
        <View style={styles.vDivider} />
        <Text style={[styles.th, { width: "12%", textAlign: "right" }]}>Total</Text>
      </View>

      {foreman.items.map((item, i) => {
        const lineTotal =
          item.unitPrice != null ? item.unitPrice * item.quantity : null;
        return (
          <React.Fragment key={i}>
            {i > 0 && <View style={styles.rowDivider} />}
            <View
              style={[styles.row, i % 2 === 1 ? styles.rowAlt : {}]}
              wrap={false}
            >
              <Text
                style={[
                  styles.td,
                  { width: "6%", textAlign: "center", color: "#999999" },
                ]}
              >
                {startIndex + i + 1}
              </Text>
              <View style={styles.vDivider} />
              <Text style={[styles.td, { flex: 1, fontWeight: 700 }]}>
                {item.productName}
              </Text>
              <View style={styles.vDivider} />
              <Text style={[styles.td, { width: "10%", textAlign: "center" }]}>
                {item.size ?? "—"}
              </Text>
              <View style={styles.vDivider} />
              <Text style={[styles.td, { width: "10%", textAlign: "center" }]}>
                {item.color ?? "—"}
              </Text>
              <View style={styles.vDivider} />
              <Text
                style={[
                  styles.td,
                  { width: "8%", textAlign: "center", fontWeight: 700 },
                ]}
              >
                {item.quantity}
              </Text>
              <View style={styles.vDivider} />
              <Text
                style={[
                  styles.td,
                  {
                    width: "12%",
                    textAlign: "right",
                    color: item.deductible === false ? "#999999" : "#111111",
                  },
                ]}
              >
                {item.deductible === false
                  ? "—"
                  : item.unitPrice != null
                    ? `R ${item.unitPrice.toFixed(2)}`
                    : "—"}
              </Text>
              <View style={styles.vDivider} />
              <Text
                style={[
                  styles.td,
                  { width: "12%", textAlign: "right", fontWeight: 700 },
                ]}
              >
                {lineTotal != null ? `R ${lineTotal.toFixed(2)}` : "—"}
              </Text>
            </View>
          </React.Fragment>
        );
      })}

      <View style={styles.totalRow} wrap={false}>
        <Text style={[styles.td, { width: "6%", textAlign: "center" }]} />
        <View style={styles.vDivider} />
        <Text
          style={[
            styles.td,
            {
              flex: 1,
              fontWeight: 700,
              fontSize: 8,
              textTransform: "uppercase",
              letterSpacing: 0.3,
            },
          ]}
        >
          Foreman Total
        </Text>
        <View style={styles.vDivider} />
        <Text style={[styles.td, { width: "10%" }]} />
        <View style={styles.vDivider} />
        <Text style={[styles.td, { width: "10%" }]} />
        <View style={styles.vDivider} />
        <Text
          style={[
            styles.td,
            { width: "8%", textAlign: "center", fontWeight: 700 },
          ]}
        >
          {totalUnits}
        </Text>
        <View style={styles.vDivider} />
        <Text style={[styles.td, { width: "12%" }]} />
        <View style={styles.vDivider} />
        <Text
          style={[
            styles.td,
            { width: "12%", textAlign: "right", fontWeight: 700 },
          ]}
        >
          {totalDeduction > 0 ? `R ${totalDeduction.toFixed(2)}` : "—"}
        </Text>
      </View>
    </View>
  );
}

export function PpeIssueVoucherDocument({ data }: { data: PpeIssueVoucherData }) {
  const grandTotalUnits = data.foremen.reduce(
    (acc, f) => acc + f.items.reduce((sum, i) => sum + i.quantity, 0),
    0,
  );
  const grandTotalDeduction = data.foremen.reduce(
    (acc, f) => acc + foremanDeductionTotal(f),
    0,
  );
  const isMultiForeman = data.foremen.length > 1;
  const single = data.foremen[0];

  return (
    <Document title={`PPE Issue Order ${data.orderNumber}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.pageBorderOuter} fixed />
        <View style={styles.pageBorderMiddle} fixed />
        <View style={styles.pageBorderInner} fixed />
        <View style={styles.watermark} fixed>
          <Text style={styles.watermarkText}>{data.supervisorName}</Text>
        </View>
        <View style={styles.box}>
          <View style={styles.topRow}>
            <View style={styles.brandBox}>
              {LOGO_DATA_URI ? (
                <Image src={LOGO_DATA_URI} style={styles.brandLogo} />
              ) : (
                <Text style={styles.brandFallback}>FIRST CLASS PROJECTS</Text>
              )}
            </View>
            <View style={styles.titleBox}>
              <Text style={styles.title}>PPE Issue Order</Text>
              <Text style={styles.subtitle}>
                Personal Protective Equipment Issue Record
              </Text>
            </View>
            <View style={styles.orderBox}>
              <Text style={styles.orderLabel}>Order Number</Text>
              <Text style={styles.orderValue}>{data.orderNumber}</Text>
              <Text style={styles.dateValue}>{data.issuedDate}</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaPanel}>
              <Text style={styles.metaPanelTitle}>
                {isMultiForeman ? "Issue Details" : "Recipient Details"}
              </Text>
              {isMultiForeman ? (
                <>
                  <MetaField
                    label="Foremen"
                    value={data.foremen.map((f) => f.foremanName).join(", ")}
                  />
                  <MetaField label="Issued To" value={data.supervisorName} />
                </>
              ) : (
                <>
                  <MetaField label="Foreman" value={single?.foremanName ?? "—"} />
                  {single?.siteName && (
                    <MetaField label="Site Name" value={single.siteName} />
                  )}
                  {single?.siteCode && (
                    <MetaField label="Site Code" value={single.siteCode} />
                  )}
                  {typeof single?.chargeToSite === "boolean" && (
                    <MetaField
                      label="Charge To Site"
                      value={single.chargeToSite ? "Yes" : "No"}
                    />
                  )}
                </>
              )}
            </View>
            <View style={styles.metaPanel}>
              <Text style={styles.metaPanelTitle}>Order Details</Text>
              <MetaField label="Order No." value={data.orderNumber} />
              <MetaField label="Date Issued" value={data.issuedDate} />
              {data.issuedBy && (
                <MetaField label="Issued By" value={data.issuedBy} />
              )}
              <MetaField label="Total Units" value={String(grandTotalUnits)} />
              {grandTotalDeduction > 0 && (
                <MetaField
                  label="Total Deduction"
                  value={`R ${grandTotalDeduction.toFixed(2)}`}
                />
              )}
              {isMultiForeman && (
                <MetaField
                  label="No. of Foremen"
                  value={String(data.foremen.length)}
                />
              )}
            </View>
          </View>

          {data.foremen.map((foreman, fIdx) => {
            const prevCount = data.foremen
              .slice(0, fIdx)
              .reduce((sum, f) => sum + f.items.length, 0);
            const sectionUnits = foreman.items.reduce(
              (s, i) => s + i.quantity,
              0,
            );
            return (
              <React.Fragment key={fIdx}>
                {isMultiForeman && (
                  <View style={styles.foremanSectionHeader} wrap={false}>
                    <Text style={styles.foremanSectionLabel}>
                      {foremanSectionLabel(foreman)}
                    </Text>
                    <Text style={styles.foremanSectionMeta}>
                      {sectionUnits} units
                    </Text>
                  </View>
                )}
                <ForemanItemsTable
                  foreman={foreman}
                  startIndex={isMultiForeman ? prevCount : 0}
                />
              </React.Fragment>
            );
          })}

          {isMultiForeman && (
            <View
              style={[styles.totalRow, { border: BORDER, marginBottom: 14 }]}
              wrap={false}
            >
              <Text style={[styles.td, { width: "6%", textAlign: "center" }]} />
              <View style={styles.vDivider} />
              <Text
                style={[
                  styles.td,
                  {
                    flex: 1,
                    fontWeight: 700,
                    fontSize: 8.5,
                    textTransform: "uppercase",
                    letterSpacing: 0.3,
                  },
                ]}
              >
                Grand Total — All Foremen
              </Text>
              <View style={styles.vDivider} />
              <Text style={[styles.td, { width: "10%" }]} />
              <View style={styles.vDivider} />
              <Text style={[styles.td, { width: "10%" }]} />
              <View style={styles.vDivider} />
              <Text
                style={[
                  styles.td,
                  { width: "8%", textAlign: "center", fontWeight: 700, fontSize: 10 },
                ]}
              >
                {grandTotalUnits}
              </Text>
              <View style={styles.vDivider} />
              <Text style={[styles.td, { width: "12%" }]} />
              <View style={styles.vDivider} />
              <Text
                style={[
                  styles.td,
                  { width: "12%", textAlign: "right", fontWeight: 700, fontSize: 10 },
                ]}
              >
                {grandTotalDeduction > 0
                  ? `R ${grandTotalDeduction.toFixed(2)}`
                  : "—"}
              </Text>
            </View>
          )}

          <View style={{ flex: 1 }} />

          <View style={styles.disclaimer}>
            <Text style={styles.disclaimerText}>
              By signing this document, the recipient confirms that all PPE items
              listed above have been received in good condition and accepts
              responsibility for their proper use and care. Deductible items will be
              recovered from wages as indicated. Any loss or damage must be reported
              immediately to the foreman or site supervisor.
            </Text>
          </View>

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
        </View>

        <View style={styles.footer} fixed>
          <Text>First Class Projects (Pty) Ltd</Text>
          <Text>{data.orderNumber} — PPE Issue Order</Text>
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

export function PpeIssueOrderDocument({ data }: { data: PpeIssueOrderData }) {
  return (
    <PpeIssueVoucherDocument
      data={{
        orderNumber: data.orderNumber,
        issuedDate: data.issuedDate,
        supervisorName: data.foremanName,
        issuedBy: data.issuedBy ?? undefined,
        foremen: [
          {
            foremanName: data.foremanName,
            siteName: data.siteName,
            siteCode: data.siteCode,
            chargeToSite: data.chargeToSite,
            items: data.items,
          },
        ],
      }}
    />
  );
}

export function PpeMultiOrderDocument({ data }: { data: PpeMultiOrderData }) {
  return (
    <PpeIssueVoucherDocument
      data={{
        orderNumber: data.orderNumber,
        issuedDate: data.issuedDate,
        supervisorName: data.supervisorName,
        foremen: data.orders.map((order) => ({
          foremanName: order.foremanName,
          siteName: order.siteName,
          siteCode: order.siteCode,
          chargeToSite: order.chargeToSite,
          items: order.items,
        })),
      }}
    />
  );
}
