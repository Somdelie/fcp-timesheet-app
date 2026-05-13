import fs from "fs";
import pdf from "pdf-parse";

async function parsePDF() {
  const data = await pdf("./scripts/activity-report.pdf");
  const text = data.text;
  console.log(text);
}

parsePDF().catch(console.error);
