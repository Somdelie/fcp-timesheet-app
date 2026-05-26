import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontSize: 9,
  },

  title: {
    fontSize: 18,
    marginBottom: 10,
    fontWeight: "bold",
    textAlign: "center",
  },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  table: {
    borderWidth: 1,
    borderColor: "#000",
  },

  row: {
    flexDirection: "row",
  },

  cell: {
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#000",
    padding: 4,
    minHeight: 22,
    justifyContent: "center",
  },

  header: {
    backgroundColor: "#e5e7eb",
    fontWeight: "bold",
  },

  nameCol: {
    width: "18%",
  },

  jobCol: {
    width: "10%",
  },

  siteCol: {
    width: "22%",
  },

  dayCol: {
    width: "4.5%",
    textAlign: "center",
  },

  totalCol: {
    width: "7%",
    textAlign: "center",
  },
});

type Row = {
  name: string;
  jobNo: string;
  site: string;
  days: string[];
  foremanDays: number;
  manDays: number;
};

type Props = {
  periodLabel: string;
  supervisor: string;
  rows: Row[];
};

export function TimesheetPDF({ periodLabel, supervisor, rows }: Props) {
  const headers = [
    "23",
    "24",
    "25",
    "26",
    "27",
    "28",
    "29",
    "30",
    "31",
    "01",
    "02",
    "03",
    "04",
    "05",
  ];

  const totalForeman = rows.reduce((sum, r) => sum + r.foremanDays, 0);

  const totalMan = rows.reduce((sum, r) => sum + r.manDays, 0);

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>TIME SHEET</Text>

        <View style={styles.topRow}>
          <Text>Date: {periodLabel}</Text>
          <Text>Contract Manager: {supervisor}</Text>
        </View>

        <View style={styles.table}>
          {/* Header */}
          <View style={[styles.row, styles.header]}>
            <Text style={[styles.cell, styles.nameCol]}>Name</Text>
            <Text style={[styles.cell, styles.jobCol]}>Job No</Text>
            <Text style={[styles.cell, styles.siteCol]}>Site</Text>

            {headers.map((h) => (
              <Text key={h} style={[styles.cell, styles.dayCol]}>
                {h}
              </Text>
            ))}

            <Text style={[styles.cell, styles.totalCol]}>F/Man Days</Text>

            <Text style={[styles.cell, styles.totalCol]}>Man Days</Text>
          </View>

          {/* Rows */}
          {rows.map((row, index) => (
            <View key={index} style={styles.row}>
              <Text style={[styles.cell, styles.nameCol]}>{row.name}</Text>

              <Text style={[styles.cell, styles.jobCol]}>{row.jobNo}</Text>

              <Text style={[styles.cell, styles.siteCol]}>{row.site}</Text>

              {row.days.map((d, i) => (
                <Text key={i} style={[styles.cell, styles.dayCol]}>
                  {d}
                </Text>
              ))}

              <Text style={[styles.cell, styles.totalCol]}>
                {row.foremanDays}
              </Text>

              <Text style={[styles.cell, styles.totalCol]}>{row.manDays}</Text>
            </View>
          ))}

          {/* Totals */}
          <View style={[styles.row, styles.header]}>
            <Text
              style={[
                styles.cell,
                {
                  width: "94%",
                  textAlign: "right",
                },
              ]}
            >
              TOTALS
            </Text>

            <Text style={[styles.cell, styles.totalCol]}>{totalForeman}</Text>

            <Text style={[styles.cell, styles.totalCol]}>{totalMan}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
