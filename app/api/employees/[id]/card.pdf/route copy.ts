import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { employeeWhereFor } from "@/lib/employee-scope";
import QRCode from "qrcode";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  degrees,
  grayscale,
  LineCapStyle,
} from "pdf-lib";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

function mmToPt(mm: number) {
  return (mm / 25.4) * 72;
}

function dataUrlToUint8Array(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] ?? "";
  const buf = Buffer.from(base64, "base64");
  return new Uint8Array(buf);
}

function moneyZAR(decimalString: string) {
  const n = Number(String(decimalString).replace(",", "."));
  if (!Number.isFinite(n)) return `R ${decimalString}`;
  return `R ${n.toFixed(2)}`;
}

function drawTextFit(opts: {
  page: any;
  text: string;
  x: number;
  y: number;
  size: number;
  font: any;
  color: any;
  maxWidth: number;
  rotate?: number;
}) {
  const { page, text, x, y, size, font, color, maxWidth, rotate } = opts;
  let t = text;
  while (t.length > 0 && font.widthOfTextAtSize(t, size) > maxWidth) {
    t = t.slice(0, -1);
  }
  if (t !== text) t = t.slice(0, Math.max(0, t.length - 1)) + "…";

  const drawOpts: any = { x, y, size, font, color };
  if (rotate !== undefined) drawOpts.rotate = rotate;

  page.drawText(t, drawOpts);
}

// Helper to create gradient effect with multiple rectangles
function drawGradient(
  page: any,
  x: number,
  y: number,
  width: number,
  height: number,
  startColor: any,
  endColor: any,
  steps: number = 20,
) {
  const stepHeight = height / steps;

  for (let i = 0; i < steps; i++) {
    const ratio = i / (steps - 1);
    const r = startColor.red + (endColor.red - startColor.red) * ratio;
    const g = startColor.green + (endColor.green - startColor.green) * ratio;
    const b = startColor.blue + (endColor.blue - startColor.blue) * ratio;

    page.drawRectangle({
      x,
      y: y + i * stepHeight,
      width,
      height: stepHeight + 1, // +1 to avoid gaps
      color: rgb(r, g, b),
    });
  }
}

// Create decorative geometric pattern
function drawGeometricPattern(
  page: any,
  x: number,
  y: number,
  size: number,
  color: any,
  opacity: number,
) {
  // Diamond pattern
  const half = size / 2;

  for (let i = 0; i < 3; i++) {
    const offset = i * (size / 6);
    const currentOpacity = opacity * (1 - i * 0.3);

    // Diamond using SVG path
    page.drawSvgPath(
      `M ${x + half} ${y} L ${x + size} ${y + half} L ${x + half} ${y + size} L ${x} ${y + half} Z`,
      {
        color,
        opacity: currentOpacity,
        rotate: degrees(i * 15),
      },
    );
  }
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  // Auth
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const role = (session?.user as any)?.role as
    | "ADMIN"
    | "SUPERVISOR"
    | "FOREMAN"
    | undefined;

  if (!userId || !role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const whereScope = employeeWhereFor({ userId, role });

  const employee = await prisma.employee.findFirst({
    where: { id: params.id, ...whereScope },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      qrCodeValue: true,
      defaultDayRate: true,
      faceImageUrl: true,
      isActive: true,
    },
  });

  if (!employee) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // CR80 card dimensions
  const W = mmToPt(85.6);
  const H = mmToPt(54.0);

  // Create PDF
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([W, H]);

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fontMono = await pdf.embedFont(StandardFonts.Courier);
  const fontItalic = await pdf.embedFont(StandardFonts.HelveticaOblique);

  // Set PDF metadata
  pdf.setTitle(`Employee Card - ${employee.firstName} ${employee.lastName}`);
  pdf.setAuthor("FirstClass Projects");
  pdf.setSubject("Worker Attendance Card");
  pdf.setKeywords(["attendance", "employee", "worker", "verification"]);
  pdf.setCreator("Employee Management System");
  pdf.setProducer("pdf-lib");
  pdf.setCreationDate(new Date());

  // ════════════════════════════════════════════════════════════════
  // ADVANCED COLOR PALETTE
  // ════════════════════════════════════════════════════════════════
  const cDeepNavy = rgb(0.05, 0.15, 0.28);
  const cNavy = rgb(0.07, 0.24, 0.45);
  const cLightNavy = rgb(0.12, 0.35, 0.58);
  const cGold = rgb(0.96, 0.65, 0.14);
  const cLightGold = rgb(0.98, 0.78, 0.35);
  const cText = rgb(0.13, 0.13, 0.15);
  const cTextLight = rgb(0.4, 0.42, 0.45);
  const cBg = rgb(0.97, 0.97, 0.98);
  const cCard = rgb(1, 1, 1);
  const cBorder = rgb(0.88, 0.9, 0.92);
  const cAccentBlue = rgb(0.2, 0.55, 0.85);
  const cSuccess = rgb(0.13, 0.59, 0.36);
  const cDanger = rgb(0.86, 0.26, 0.21);

  // ════════════════════════════════════════════════════════════════
  // BACKGROUND WITH SUBTLE TEXTURE
  // ════════════════════════════════════════════════════════════════

  // Base background
  page.drawRectangle({
    x: 0,
    y: 0,
    width: W,
    height: H,
    color: cBg,
  });

  // Subtle noise texture effect (dots pattern)
  for (let i = 0; i < 150; i++) {
    const randX = Math.random() * W;
    const randY = Math.random() * H;
    const randSize = Math.random() * 0.5 + 0.3;

    page.drawCircle({
      x: randX,
      y: randY,
      size: randSize,
      color: grayscale(0.7),
      opacity: 0.1,
    });
  }

  // ════════════════════════════════════════════════════════════════
  // MAIN CARD WITH SHADOW
  // ════════════════════════════════════════════════════════════════
  const cardMargin = mmToPt(1.5);
  const cardX = cardMargin;
  const cardY = cardMargin;
  const cardW = W - 2 * cardMargin;
  const cardH = H - 2 * cardMargin;

  // Multi-layer shadow for depth
  const shadowLayers = [
    { offset: 4, opacity: 0.08 },
    { offset: 3, opacity: 0.06 },
    { offset: 2, opacity: 0.04 },
    { offset: 1, opacity: 0.02 },
  ];

  shadowLayers.forEach(({ offset, opacity }) => {
    page.drawRectangle({
      x: cardX + offset * 0.5,
      y: cardY - offset * 0.5,
      width: cardW,
      height: cardH,
      color: rgb(0.2, 0.2, 0.25),
      opacity,
    });
  });

  // Main card background
  page.drawRectangle({
    x: cardX,
    y: cardY,
    width: cardW,
    height: cardH,
    color: cCard,
  });

  // Subtle inner border
  page.drawRectangle({
    x: cardX + 1,
    y: cardY + 1,
    width: cardW - 2,
    height: cardH - 2,
    borderWidth: 0.5,
    borderColor: cBorder,
  });

  // ════════════════════════════════════════════════════════════════
  // HEADER WITH GRADIENT BACKGROUND
  // ════════════════════════════════════════════════════════════════
  const headerH = mmToPt(18);

  // Gradient background for header
  drawGradient(
    page,
    cardX,
    cardY + cardH - headerH,
    cardW,
    headerH,
    cDeepNavy,
    cNavy,
    25,
  );

  // Gold accent stripe at top
  drawGradient(
    page,
    cardX,
    cardY + cardH - mmToPt(2),
    cardW,
    mmToPt(2),
    cGold,
    cLightGold,
    15,
  );

  // Decorative diagonal lines in header
  for (let i = 0; i < 8; i++) {
    const lineX = cardX + cardW - mmToPt(25) + i * mmToPt(3);
    page.drawLine({
      start: { x: lineX, y: cardY + cardH - headerH },
      end: { x: lineX + mmToPt(8), y: cardY + cardH - mmToPt(2) },
      thickness: 1,
      color: rgb(1, 1, 1),
      opacity: 0.05 + i * 0.01,
      lineCap: LineCapStyle.Round,
    });
  }

  // Geometric pattern in top-right
  drawGeometricPattern(
    page,
    cardX + cardW - mmToPt(14),
    cardY + cardH - headerH + mmToPt(3),
    mmToPt(8),
    cLightGold,
    0.15,
  );

  // Company branding with shadow effect
  const brand = "FirstClass Projects";
  const subtitle = "WORKER ATTENDANCE CARD";

  const brandX = cardX + mmToPt(4.5);
  const brandY = cardY + cardH - mmToPt(6.5);

  // Text shadow
  page.drawText(brand, {
    x: brandX + 1,
    y: brandY - 1,
    size: 17,
    font: fontBold,
    color: rgb(0, 0, 0),
    opacity: 0.3,
  });

  // Main brand text
  page.drawText(brand, {
    x: brandX,
    y: brandY,
    size: 17,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText(subtitle, {
    x: brandX,
    y: brandY - mmToPt(5.5),
    size: 7.5,
    font: font,
    color: cLightGold,
  });

  // ════════════════════════════════════════════════════════════════
  // DECORATIVE SIDE ACCENT
  // ════════════════════════════════════════════════════════════════

  // Vertical accent stripe on left
  const accentW = mmToPt(1.2);
  drawGradient(
    page,
    cardX,
    cardY,
    accentW,
    cardH - headerH,
    cAccentBlue,
    cNavy,
    20,
  );

  // ════════════════════════════════════════════════════════════════
  // QR CODE SECTION WITH ENHANCED STYLING
  // ════════════════════════════════════════════════════════════════
  const contentPad = mmToPt(5);
  const contentX = cardX + accentW + contentPad;
  const contentTop = cardY + cardH - headerH - mmToPt(2.5);
  const contentBottom = cardY + mmToPt(2);

  const qrSize = mmToPt(30);
  const qrX = cardX + cardW - contentPad - qrSize;
  const qrY = contentBottom + mmToPt(4.5);

  // QR container with multiple borders
  // Outer decorative border
  page.drawRectangle({
    x: qrX - mmToPt(2.5),
    y: qrY - mmToPt(2.5),
    width: qrSize + mmToPt(5),
    height: qrSize + mmToPt(5),
    borderWidth: 1.5,
    borderColor: cGold,
    opacity: 0.3,
  });

  // Inner frame
  page.drawRectangle({
    x: qrX - mmToPt(1.5),
    y: qrY - mmToPt(1.5),
    width: qrSize + mmToPt(3),
    height: qrSize + mmToPt(3),
    color: rgb(0.98, 0.98, 0.99),
    borderWidth: 1,
    borderColor: cBorder,
  });

  // Corner decorations for QR frame
  const cornerSize = mmToPt(2);
  const corners = [
    { x: qrX - mmToPt(2.5), y: qrY + qrSize + mmToPt(2.5) }, // top-left
    { x: qrX + qrSize + mmToPt(0.5), y: qrY + qrSize + mmToPt(2.5) }, // top-right
    { x: qrX - mmToPt(2.5), y: qrY - mmToPt(2.5) }, // bottom-left
    { x: qrX + qrSize + mmToPt(0.5), y: qrY - mmToPt(2.5) }, // bottom-right
  ];

  corners.forEach((corner, idx) => {
    page.drawRectangle({
      x: corner.x,
      y: corner.y,
      width: cornerSize,
      height: cornerSize,
      color: cGold,
    });
  });

  // Generate and embed QR code
  const qrDataUrl = await QRCode.toDataURL(employee.qrCodeValue, {
    errorCorrectionLevel: "H",
    margin: 1,
    width: 700,
    type: "image/png",
    color: {
      dark: "#0A1829FF",
      light: "#00000000",
    },
  });

  const qrBytes = dataUrlToUint8Array(qrDataUrl);
  const qrImg = await pdf.embedPng(qrBytes);

  page.drawImage(qrImg, {
    x: qrX,
    y: qrY,
    width: qrSize,
    height: qrSize,
  });

  // QR scan instruction with icon-like elements
  const scanY = qrY - mmToPt(5);

  // Scan icon (simplified)
  const iconSize = mmToPt(3);
  const iconX = qrX + qrSize / 2 - mmToPt(8);

  page.drawRectangle({
    x: iconX,
    y: scanY,
    width: iconSize,
    height: iconSize,
    borderWidth: 1.5,
    borderColor: cAccentBlue,
  });

  // Scan lines
  for (let i = 0; i < 3; i++) {
    page.drawLine({
      start: {
        x: iconX + mmToPt(0.5),
        y: scanY + mmToPt(0.5) + i * mmToPt(0.8),
      },
      end: {
        x: iconX + iconSize - mmToPt(0.5),
        y: scanY + mmToPt(0.5) + i * mmToPt(0.8),
      },
      thickness: 0.5,
      color: cAccentBlue,
    });
  }

  page.drawText("SCAN TO VERIFY", {
    x: iconX + mmToPt(4.5),
    y: scanY + mmToPt(0.6),
    size: 7,
    font: fontBold,
    color: cTextLight,
  });

  // ════════════════════════════════════════════════════════════════
  // EMPLOYEE INFORMATION WITH ENHANCED DESIGN
  // ════════════════════════════════════════════════════════════════
  const leftW = qrX - contentX - mmToPt(7);
  const fullName = `${employee.firstName} ${employee.lastName}`.trim();
  const workerCode = employee.qrCodeValue.replace(/^EMP_/, "");
  const rate = moneyZAR(String(employee.defaultDayRate));

  let currentY = contentTop;

  // Section: Name
  page.drawText("EMPLOYEE NAME", {
    x: contentX,
    y: currentY,
    size: 6.5,
    font: font,
    color: cTextLight,
  });

  currentY -= mmToPt(6.5);

  // Name with custom styling
  drawTextFit({
    page,
    text: fullName.toUpperCase(),
    x: contentX,
    y: currentY,
    size: 14,
    font: fontBold,
    color: cText,
    maxWidth: leftW,
  });

  // Decorative underline with gradient effect
  const nameWidth = Math.min(
    fontBold.widthOfTextAtSize(fullName.toUpperCase(), 14),
    leftW,
  );

  const underlineY = currentY - mmToPt(1.2);
  const underlineSteps = 20;
  const underlineStepW = nameWidth / underlineSteps;

  for (let i = 0; i < underlineSteps; i++) {
    const ratio = i / underlineSteps;
    page.drawRectangle({
      x: contentX + i * underlineStepW,
      y: underlineY,
      width: underlineStepW + 0.5,
      height: 2,
      color: rgb(
        cGold.red + (cAccentBlue.red - cGold.red) * ratio,
        cGold.green + (cAccentBlue.green - cGold.green) * ratio,
        cGold.blue + (cAccentBlue.blue - cGold.blue) * ratio,
      ),
    });
  }

  currentY -= mmToPt(11);

  // Section: Worker ID with styled badge
  page.drawText("WORKER ID", {
    x: contentX,
    y: currentY,
    size: 6.5,
    font: font,
    color: cTextLight,
  });

  currentY -= mmToPt(6);

  // ID Badge with angled design
  const badgeW = mmToPt(22);
  const badgeH = mmToPt(7);

  // Badge background with gradient
  drawGradient(
    page,
    contentX,
    currentY - mmToPt(1),
    badgeW,
    badgeH,
    cNavy,
    cDeepNavy,
    10,
  );

  // Badge border
  page.drawRectangle({
    x: contentX,
    y: currentY - mmToPt(1),
    width: badgeW,
    height: badgeH,
    borderWidth: 1,
    borderColor: cGold,
    opacity: 0.5,
  });

  // Decorative corner accent
  page.drawSvgPath(
    `M ${contentX} ${currentY - mmToPt(1)} L ${contentX + mmToPt(3)} ${currentY - mmToPt(1)} L ${contentX} ${currentY + mmToPt(2)} Z`,
    {
      color: cGold,
      opacity: 0.6,
    },
  );

  // ID Code text
  page.drawText(workerCode, {
    x: contentX + mmToPt(1.5),
    y: currentY + mmToPt(1.5),
    size: 11,
    font: fontMono,
    color: rgb(1, 1, 1),
  });

  currentY -= mmToPt(12);

  // Section: Daily Rate in styled info box
  const rateBoxW = mmToPt(28);
  const rateBoxH = mmToPt(8);

  // Rate box background
  page.drawRectangle({
    x: contentX,
    y: currentY - rateBoxH + mmToPt(5),
    width: rateBoxW,
    height: rateBoxH,
    color: rgb(0.96, 0.97, 0.98),
    borderWidth: 1,
    borderColor: cBorder,
  });

  // Left accent stripe on rate box
  page.drawRectangle({
    x: contentX,
    y: currentY - rateBoxH + mmToPt(5),
    width: mmToPt(0.8),
    height: rateBoxH,
    color: cAccentBlue,
  });

  page.drawText("Daily Rate", {
    x: contentX + mmToPt(2),
    y: currentY,
    size: 6.5,
    font: font,
    color: cTextLight,
  });

  page.drawText(rate, {
    x: contentX + mmToPt(2),
    y: currentY - mmToPt(4),
    size: 11,
    font: fontBold,
    color: cNavy,
  });

  // Currency icon (R symbol styled)
  page.drawCircle({
    x: contentX + rateBoxW - mmToPt(3),
    y: currentY - mmToPt(2),
    size: mmToPt(2.5),
    borderWidth: 1.5,
    borderColor: cGold,
    opacity: 0.3,
  });

  // ════════════════════════════════════════════════════════════════
  // FOOTER SECTION WITH DECORATIVE ELEMENTS
  // ════════════════════════════════════════════════════════════════

  const dividerY = contentBottom + mmToPt(1);

  // Dashed divider line
  const dashLength = 3;
  const gapLength = 2;
  let dashX = contentX;

  while (dashX < qrX - mmToPt(3)) {
    page.drawLine({
      start: { x: dashX, y: dividerY },
      end: { x: Math.min(dashX + dashLength, qrX - mmToPt(3)), y: dividerY },
      thickness: 0.8,
      color: cBorder,
      lineCap: LineCapStyle.Round,
    });
    dashX += dashLength + gapLength;
  }

  // Footer text with icon
  const footerY = dividerY - mmToPt(3);

  // Warning icon
  page.drawCircle({
    x: contentX + mmToPt(1.5),
    y: footerY + mmToPt(1.5),
    size: mmToPt(1.8),
    color: cGold,
    opacity: 0.2,
  });

  page.drawText("!", {
    x: contentX + mmToPt(1.1),
    y: footerY + mmToPt(0.8),
    size: 8,
    font: fontBold,
    color: cGold,
  });

  page.drawText("Present card daily for attendance. No scan = No record.", {
    x: contentX + mmToPt(4),
    y: footerY,
    size: 6.5,
    font: fontItalic,
    color: rgb(0.35, 0.37, 0.4),
  });

  // ════════════════════════════════════════════════════════════════
  // STATUS BADGE WITH ENHANCED DESIGN
  // ════════════════════════════════════════════════════════════════

  const statusX = qrX - mmToPt(3);
  const statusY = contentTop + mmToPt(0.5);

  if (employee.isActive) {
    const activeText = "ACTIVE";
    const activeW = fontBold.widthOfTextAtSize(activeText, 7.5);
    const badgeWidth = activeW + mmToPt(4);
    const badgeHeight = mmToPt(5);

    // Badge background with gradient
    drawGradient(
      page,
      statusX - badgeWidth,
      statusY - mmToPt(1),
      badgeWidth,
      badgeHeight,
      cSuccess,
      rgb(0.1, 0.7, 0.4),
      8,
    );

    // Badge border
    page.drawRectangle({
      x: statusX - badgeWidth,
      y: statusY - mmToPt(1),
      width: badgeWidth,
      height: badgeHeight,
      borderWidth: 1,
      borderColor: rgb(1, 1, 1),
      opacity: 0.3,
    });

    // Checkmark icon
    page.drawCircle({
      x: statusX - badgeWidth + mmToPt(1.5),
      y: statusY + mmToPt(1.2),
      size: mmToPt(1.2),
      color: rgb(1, 1, 1),
      opacity: 0.5,
    });

    page.drawText(activeText, {
      x: statusX - badgeWidth + mmToPt(3.5),
      y: statusY + mmToPt(0.3),
      size: 7.5,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
  } else {
    const inactiveText = "INACTIVE";
    const inactiveW = fontBold.widthOfTextAtSize(inactiveText, 8.5);
    const badgeWidth = inactiveW + mmToPt(5);
    const badgeHeight = mmToPt(6);

    // Warning badge
    drawGradient(
      page,
      statusX - badgeWidth,
      statusY - mmToPt(1.5),
      badgeWidth,
      badgeHeight,
      cDanger,
      rgb(0.7, 0.2, 0.15),
      8,
    );

    page.drawRectangle({
      x: statusX - badgeWidth,
      y: statusY - mmToPt(1.5),
      width: badgeWidth,
      height: badgeHeight,
      borderWidth: 1.5,
      borderColor: rgb(1, 1, 1),
      opacity: 0.4,
    });

    // Warning icon
    const warnX = statusX - badgeWidth + mmToPt(1.5);
    const warnY = statusY + mmToPt(0.8);

    page.drawSvgPath(
      `M ${warnX} ${warnY + mmToPt(1.2)} L ${warnX + mmToPt(1)} ${warnY} L ${warnX + mmToPt(2)} ${warnY + mmToPt(1.2)} Z`,
      {
        color: rgb(1, 1, 1),
        opacity: 0.6,
      },
    );

    page.drawText(inactiveText, {
      x: statusX - badgeWidth + mmToPt(4.5),
      y: statusY + mmToPt(0.2),
      size: 8.5,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    // Large diagonal watermark
    const watermarkText = "CARD DISABLED";
    page.drawText(watermarkText, {
      x: W / 2 - mmToPt(18),
      y: H / 2 - mmToPt(3),
      size: 14,
      font: fontBold,
      color: cDanger,
      opacity: 0.08,
      rotate: degrees(-25),
    });
  }

  // ════════════════════════════════════════════════════════════════
  // DECORATIVE BOTTOM CORNER ELEMENT
  // ════════════════════════════════════════════════════════════════

  const cornerPatternSize = mmToPt(8);
  for (let i = 0; i < 3; i++) {
    const size = cornerPatternSize - i * mmToPt(2);
    page.drawEllipse({
      x: cardX + mmToPt(2),
      y: cardY + mmToPt(2),
      xScale: size / 2,
      yScale: size / 2,
      borderWidth: 1,
      borderColor: cAccentBlue,
      opacity: 0.1 - i * 0.02,
    });
  }

  // ════════════════════════════════════════════════════════════════
  // FINALIZE AND RETURN
  // ════════════════════════════════════════════════════════════════

  const pdfBytes = await pdf.save();
  const ab = new ArrayBuffer(pdfBytes.byteLength);
  new Uint8Array(ab).set(pdfBytes as unknown as Uint8Array);

  return new Response(ab, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="employee-card-${employee.id}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
