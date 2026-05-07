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

export interface ProductOrderVoucherData {
  orderNumber: string;
  issuedDate: string;
  recipientName: string;
  recipientType: "foreman" | "admin";
  items: {
    productName: string;
    size?: string | null;
    color?: string | null;
    quantity: number;
    unitPrice: number;
    note?: string | null;
  }[];
}

const styles = StyleSheet.create({
  page: {
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#111111",
    lineHeight: 1.25,
    paddingTop: 52,
    paddingBottom: 68,
    paddingHorizontal: 42,
    position: "relative",
  },

  /* Full page border */
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
    gap: 2,
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

export function ProductOrderVoucherDocument({
  data,
}: {
  data: ProductOrderVoucherData;
}) {
  const totalQty = data.items.reduce((s, i) => s + i.quantity, 0);
  const totalValue = data.items.reduce(
    (s, i) => s + i.quantity * i.unitPrice,
    0,
  );

  const fmt = (n: number) =>
    `R ${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

  return (
    <Document title={`Product Order ${data.orderNumber}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.pageBorderOuter} fixed />
        <View style={styles.pageBorderMiddle} fixed />
        <View style={styles.pageBorderInner} fixed />

        <View style={styles.box}>
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
              <Text style={styles.title}>PPE/Tools Order</Text>
              <Text style={styles.subtitle}>PPE &amp; Tools Issue Record</Text>
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
              <Text style={styles.metaPanelTitle}>Recipient Details</Text>
              <MetaField
                label={data.recipientType === "admin" ? "Admin" : "Foreman"}
                value={data.recipientName}
              />
              <MetaField label="Date" value={data.issuedDate} />
            </View>
            <View style={styles.metaPanel}>
              <Text style={styles.metaPanelTitle}>Order Summary</Text>
              <MetaField label="Order No." value={data.orderNumber} />
              <MetaField
                label="Total Items"
                value={String(data.items.length)}
              />
              <MetaField label="Total Qty" value={String(totalQty)} />
              {/* <MetaField label="Total Value" value={fmt(totalValue)} /> */}
            </View>
          </View>

          {/* ---- Items table ---- */}
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { width: "6%", textAlign: "center" }]}>
                No.
              </Text>
              <View style={styles.vDivider} />
              <Text style={[styles.th, { flex: 1 }]}>Product</Text>
              <View style={styles.vDivider} />
              <Text style={[styles.th, { width: "10%", textAlign: "center" }]}>
                Size
              </Text>
              <View style={styles.vDivider} />
              <Text style={[styles.th, { width: "10%", textAlign: "center" }]}>
                Color
              </Text>
              <View style={styles.vDivider} />
              <Text style={[styles.th, { width: "8%", textAlign: "center" }]}>
                Qty
              </Text>
              <View style={styles.vDivider} />
              <Text style={[styles.th, { width: "14%", textAlign: "right" }]}>
                Total
              </Text>
              <View style={styles.vDivider} />
              <Text style={[styles.th, { width: "22%" }]}>Note</Text>
            </View>

            {data.items.map((item, i) => (
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
                    {i + 1}
                  </Text>
                  <View style={styles.vDivider} />
                  <Text style={[styles.td, { flex: 1, fontWeight: 700 }]}>
                    {item.productName}
                  </Text>
                  <View style={styles.vDivider} />
                  <Text
                    style={[
                      styles.td,
                      { width: "10%", textAlign: "center", color: "#555" },
                    ]}
                  >
                    {item.size ?? "—"}
                  </Text>
                  <View style={styles.vDivider} />
                  <Text
                    style={[
                      styles.td,
                      { width: "10%", textAlign: "center", color: "#555" },
                    ]}
                  >
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
                      { width: "14%", textAlign: "right", fontWeight: 700 },
                    ]}
                  >
                    {fmt(item.quantity * item.unitPrice)}
                  </Text>
                  <View style={styles.vDivider} />
                  <Text style={[styles.td, { width: "22%", color: "#555555" }]}>
                    {item.note ?? ""}
                  </Text>
                </View>
              </React.Fragment>
            ))}

            {/* Total row */}
            <View style={styles.totalRow} wrap={false}>
              <Text style={[styles.td, { width: "6%" }]} />
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
                Total
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
                {totalQty}
              </Text>
              <View style={styles.vDivider} />
              <Text
                style={[
                  styles.td,
                  { width: "14%", textAlign: "right", fontWeight: 700 },
                ]}
              >
                {fmt(totalValue)}
              </Text>
              <View style={styles.vDivider} />
              <Text style={[styles.td, { width: "22%" }]} />
            </View>
          </View>

          {/* Spacer */}
          <View style={{ flex: 1 }} />

          {/* ---- Disclaimer ---- */}
          <View style={styles.disclaimer}>
            <Text style={styles.disclaimerText}>
              By signing this document, the recipient confirms that all items
              listed above have been received in good condition and accepts
              responsibility for their safekeeping. Any discrepancies must be
              reported immediately to the office.
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
            <Text>{data.orderNumber} — PPE/Tools Order</Text>
            <Text
              render={({ pageNumber, totalPages }) =>
                `Page ${pageNumber} of ${totalPages}`
              }
            />
          </View>
        </View>
      </Page>
    </Document>
  );
}
