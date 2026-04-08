import fs from "node:fs";
import path from "node:path";

type ManualReviewRow = {
  orderId: string;
  orderReference: string | null;
  itemId: string;
  rawName: string;
  currentProductId: string;
  currentProductName: string;
  currentPrice: string;
  mode: string;
  reason: string;
};

type RepairReport = {
  manualReview?: ManualReviewRow[];
};

function csv(value: unknown): string {
  const text = String(value ?? "");
  const escaped = text.replace(/"/g, '""');
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

function writeCsv(filePath: string, headers: string[], rows: string[][]) {
  const lines = [
    headers.join(","),
    ...rows.map((row) => row.map(csv).join(",")),
  ];
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}

function main() {
  const reportPath = path.resolve(
    process.cwd(),
    "scripts",
    "buildsmart-order-repair-report.json",
  );

  if (!fs.existsSync(reportPath)) {
    throw new Error(
      `Report not found at ${reportPath}. Run repair dry-run first.`,
    );
  }

  const report = JSON.parse(
    fs.readFileSync(reportPath, "utf8"),
  ) as RepairReport;
  const manualReview = report.manualReview ?? [];

  const detailPath = path.resolve(
    process.cwd(),
    "scripts",
    "buildsmart-manual-review.csv",
  );

  writeCsv(
    detailPath,
    [
      "orderId",
      "orderReference",
      "itemId",
      "rawName",
      "currentProductId",
      "currentProductName",
      "currentPrice",
      "mode",
      "reason",
    ],
    manualReview.map((row) => [
      row.orderId,
      row.orderReference ?? "",
      row.itemId,
      row.rawName,
      row.currentProductId,
      row.currentProductName,
      row.currentPrice,
      row.mode,
      row.reason,
    ]),
  );

  const grouped = new Map<
    string,
    { mode: string; reason: string; count: number; examples: Set<string> }
  >();

  for (const row of manualReview) {
    const key = `${row.mode}::${row.reason}`;
    const current = grouped.get(key) ?? {
      mode: row.mode,
      reason: row.reason,
      count: 0,
      examples: new Set<string>(),
    };
    current.count += 1;
    if (current.examples.size < 10) current.examples.add(row.rawName);
    grouped.set(key, current);
  }

  const groupedPath = path.resolve(
    process.cwd(),
    "scripts",
    "buildsmart-manual-review-grouped.csv",
  );

  const groupedRows = [...grouped.values()]
    .sort((a, b) => b.count - a.count || a.mode.localeCompare(b.mode))
    .map((row) => [
      row.mode,
      row.count.toString(),
      row.reason,
      [...row.examples].join(" | "),
    ]);

  writeCsv(groupedPath, ["mode", "count", "reason", "examples"], groupedRows);

  console.log(`Manual review rows: ${manualReview.length}`);
  console.log(`Detail CSV: ${detailPath}`);
  console.log(`Grouped CSV: ${groupedPath}`);
}

main();
