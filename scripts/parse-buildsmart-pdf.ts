import fs from "fs";
import pdfParse from "pdf-parse";

async function parseBuildSmartPDF(filePath: string) {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  const text = data.text;

  console.log("Extracted text from PDF:");
  console.log(text);

  // Now, parse the text for historical costs.
  // Assuming the format is lines with ledgerCode, externalRef, description, transactionDate, amount, category

  const lines = text
    .split("\n")
    .map((line: string) => line.trim())
    .filter((line: string) => line);

  const historicalCosts: any[] = [];

  for (const line of lines) {
    // Parse logic here. For example, if line contains '924015' it's labour, etc.
    // This is placeholder; need to adjust based on actual PDF content.
    if (line.includes("924015")) {
      // Parse labour line
      // Example: extract date, amount, etc.
      // For now, add placeholder
      historicalCosts.push({
        category: "LABOUR",
        ledgerCode: "924015",
        // etc.
      });
    }
  }

  return historicalCosts;
}

// Usage
parseBuildSmartPDF("./activity-report.pdf")
  .then((costs) => {
    console.log("Parsed costs:", costs);
  })
  .catch(console.error);
