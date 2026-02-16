import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
pdfMake.vfs = pdfFonts.pdfMake.vfs;

export function downloadSamplePdf() {
  const docDefinition = {
    content: [
      { text: "Timesheet Report", style: "header" },
      { text: "✓ Present (SVG/Unicode supported)", margin: [0, 10] },
      { text: "X Absent", margin: [0, 0, 0, 10] },
      {
        table: {
          body: [
            ["Name", "Status"],
            ["John Doe", { text: "✓", color: "green" }],
            ["Jane Smith", { text: "X", color: "red" }],
          ],
        },
      },
    ],
    styles: {
      header: { fontSize: 18, bold: true },
    },
  };
  pdfMake.createPdf(docDefinition).download("sample-timesheet.pdf");
}
