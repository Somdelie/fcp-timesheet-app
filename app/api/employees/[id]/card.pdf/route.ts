// app/api/employees/[id]/card.pdf/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { employeeWhereFor } from "@/lib/employee-scope";
import { authOptions } from "@/lib/auth";

import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function mmToPt(mm: number) {
  return (mm / 25.4) * 72;
}

function dataUrlToUint8Array(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] ?? "";
  const buf = Buffer.from(base64, "base64");
  return new Uint8Array(buf);
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
}) {
  const { page, text, x, y, size, font, color, maxWidth } = opts;
  let t = String(text ?? "");
  while (t.length > 0 && font.widthOfTextAtSize(t, size) > maxWidth) {
    t = t.slice(0, -1);
  }
  if (t !== text) t = t.slice(0, Math.max(0, t.length - 1)) + "…";
  page.drawText(t, { x, y, size, font, color });
}

async function embedLogo(pdf: PDFDocument) {
  const logoPath = path.join(process.cwd(), "public", "logo.png");
  try {
    const bytes = await readFile(logoPath);
    return await pdf.embedPng(bytes);
  } catch {
    return null;
  }
}

async function embedFallbackEmployeeImage(pdf: PDFDocument) {
  const fallbackPath = path.join(process.cwd(), "public", "employeeImage.jpeg");
  try {
    const bytes = await readFile(fallbackPath);
    return await pdf.embedJpg(bytes);
  } catch {
    return null;
  }
}

async function embedEmployeePhoto(pdf: PDFDocument, url: string) {
  if (!/^https?:\/\//i.test(url)) return null;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;

    const bytes = new Uint8Array(await res.arrayBuffer());
    const lower = url.toLowerCase();

    if (lower.endsWith(".png")) return await pdf.embedPng(bytes);
    return await pdf.embedJpg(bytes);
  } catch {
    return null;
  }
}

export async function GET(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;

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
    where: { id, ...whereScope },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      qrCodeValue: true,
      faceImageUrl: true,
      isActive: true,
    },
  });

  if (!employee) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // CR80
  const W = mmToPt(85.6);
  const H = mmToPt(54.0);

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fontMono = await pdf.embedFont(StandardFonts.Courier);

  // Palette
  const cAccent = rgb(0.1, 0.42, 0.78);
  const cBg = rgb(1, 1, 1);
  const cBorder = rgb(0.86, 0.88, 0.9);
  const cPanel = rgb(0.98, 0.98, 0.99);
  const cText = rgb(0.12, 0.12, 0.14);
  const cTextMuted = rgb(0.55, 0.58, 0.62);
  const cTextLight = rgb(0.38, 0.4, 0.44);
  const cQrBg = rgb(0.96, 0.97, 0.98);
  const cHeaderBg = rgb(0.97, 0.98, 0.99);

  const margin = mmToPt(4);
  const headerH = mmToPt(14);
  const contentPad = mmToPt(3.5);

  const logo = await embedLogo(pdf);

  let logoW = 0;
  let logoH = 0;
  if (logo) {
    const maxLogoW = mmToPt(36);
    const maxLogoH = mmToPt(10);
    const scale = Math.min(maxLogoW / logo.width, maxLogoH / logo.height);
    logoW = logo.width * scale;
    logoH = logo.height * scale;
  }

  // =========================================================
  // FRONT PAGE (QR) - LIGHT HEADER
  // =========================================================
  const page = pdf.addPage([W, H]);

  // Background + border
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: cBg });
  page.drawRectangle({
    x: mmToPt(0.5),
    y: mmToPt(0.5),
    width: W - mmToPt(1),
    height: H - mmToPt(1),
    borderWidth: 1.3,
    borderColor: cBorder,
  });

  // Header (light)
  const headerY = H - headerH - mmToPt(0.5);
  page.drawRectangle({
    x: mmToPt(0.5),
    y: headerY,
    width: W - mmToPt(1),
    height: headerH,
    color: cHeaderBg,
  });

  // Thin accent line at very top (clean, optional)
  page.drawRectangle({
    x: mmToPt(0.5),
    y: H - mmToPt(0.5) - mmToPt(1.6),
    width: W - mmToPt(1),
    height: mmToPt(1.6),
    color: cAccent,
  });

  // Logo / fallback text (black-friendly)
  if (logo) {
    page.drawImage(logo, {
      x: margin,
      y: headerY + (headerH - logoH) / 2,
      width: logoW,
      height: logoH,
    });
  } else {
    page.drawText("FIRSTCLASS PROJECTS", {
      x: margin,
      y: headerY + mmToPt(5),
      size: 11,
      font: fontBold,
      color: cText,
    });
  }

  // Subtitle far right (accent color)
  const subtitleText = "Attendance Card";
  const subtitleFontSize = 10.5;
  const subtitleWidth = fontBold.widthOfTextAtSize(
    subtitleText,
    subtitleFontSize,
  );
  const subtitleX = W - margin - subtitleWidth;
  const subtitleY = headerY + (headerH - subtitleFontSize) / 2;

  page.drawText(subtitleText, {
    x: subtitleX,
    y: subtitleY,
    size: subtitleFontSize,
    font: fontBold,
    color: cAccent,
  });

  // Content area
  const contentY = mmToPt(0.5);
  const contentH = headerY - contentY;

  page.drawRectangle({
    x: mmToPt(0.5),
    y: contentY,
    width: W - mmToPt(1),
    height: contentH,
    color: cBg,
  });

  // QR container (right)
  const qrSize = mmToPt(30);
  const qrX = W - margin - qrSize;
  const qrY = contentY + mmToPt(10);

  page.drawRectangle({
    x: qrX - mmToPt(1),
    y: qrY - mmToPt(1),
    width: qrSize + mmToPt(2),
    height: qrSize + mmToPt(2),
    color: cQrBg,
    borderWidth: 1,
    borderColor: cBorder,
  });

  // QR generation
  const qrDataUrl = await QRCode.toDataURL(employee.qrCodeValue, {
    errorCorrectionLevel: "H",
    margin: 1,
    width: 512,
    type: "image/png",
    color: { dark: "#111827", light: "#FFFFFF" },
  });

  const qrBytes = dataUrlToUint8Array(qrDataUrl);
  const qrImg = await pdf.embedPng(qrBytes);

  const qrPadding = mmToPt(2);
  page.drawImage(qrImg, {
    x: qrX - mmToPt(1) + qrPadding,
    y: qrY - mmToPt(1) + qrPadding,
    width: qrSize + mmToPt(2) - qrPadding * 2,
    height: qrSize + mmToPt(2) - qrPadding * 2,
  });

  page.drawText("SCAN TO CLOCK IN", {
    x: qrX + qrSize / 2 - mmToPt(10.5),
    y: qrY - mmToPt(4),
    size: 6.3,
    font: fontBold,
    color: cTextMuted,
  });

  // Left content
  const contentLeft = margin;
  const contentTop = headerY - contentPad;
  const leftWidth = qrX - contentLeft - mmToPt(6);

  const fullName = `${employee.firstName} ${employee.lastName}`
    .trim()
    .toUpperCase();

  page.drawText("WORKER", {
    x: contentLeft,
    y: contentTop - mmToPt(3),
    size: 7,
    font,
    color: cTextMuted,
  });

  drawTextFit({
    page,
    text: fullName,
    x: contentLeft,
    y: contentTop - mmToPt(9),
    size: 15,
    font: fontBold,
    color: cText,
    maxWidth: leftWidth,
  });

  // subtle accent bar (not under logo)
  page.drawRectangle({
    x: contentLeft,
    y: contentTop - mmToPt(10.5),
    width: mmToPt(18),
    height: 1,
    color: cAccent,
  });

  const workerCode = employee.qrCodeValue.replace(/^EMP_/, "");
  const idY = contentTop - mmToPt(16);

  page.drawText("WORKER ID", {
    x: contentLeft,
    y: idY,
    size: 6.5,
    font,
    color: cTextMuted,
  });

  const idBoxPad = mmToPt(1.5);
  const idTextW = fontMono.widthOfTextAtSize(workerCode, 12);
  const idBoxW = Math.min(leftWidth, idTextW + idBoxPad * 2);

  page.drawRectangle({
    x: contentLeft,
    y: idY - mmToPt(6.5),
    width: idBoxW,
    height: mmToPt(5),
    color: cPanel,
    borderWidth: 1,
    borderColor: cBorder,
  });

  page.drawText(workerCode, {
    x: contentLeft + idBoxPad,
    y: idY - mmToPt(5),
    size: 12,
    font: fontMono,
    color: cText,
  });

  // Divider + footer copy
  const dividerY = contentY + mmToPt(8);
  page.drawRectangle({
    x: margin,
    y: dividerY,
    width: W - 2 * margin,
    height: 0.6,
    color: cBorder,
  });

  page.drawText("Present this card at the site entrance for attendance.", {
    x: margin,
    y: contentY + mmToPt(3.2),
    size: 5.2,
    font,
    color: cTextLight,
  });

  page.drawText("No scan = No recorded attendance.", {
    x: margin,
    y: contentY + mmToPt(1.2),
    size: 5,
    font: fontBold,
    color: cTextMuted,
  });

  // Status indicator
  if (!employee.isActive) {
    const stampW = mmToPt(22);
    const stampH = mmToPt(7);
    const stampX = W - margin - stampW;
    const stampY = contentY + mmToPt(2);

    page.drawRectangle({
      x: stampX,
      y: stampY,
      width: stampW,
      height: stampH,
      color: rgb(0.92, 0.18, 0.18),
      borderWidth: 1.2,
      borderColor: rgb(0.75, 0.1, 0.1),
    });

    page.drawText("INACTIVE", {
      x: stampX + mmToPt(3.7),
      y: stampY + mmToPt(2.5),
      size: 9,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
  } else {
    page.drawRectangle({
      x: W - margin - mmToPt(2.5),
      y: contentY + mmToPt(4),
      width: mmToPt(2),
      height: mmToPt(2),
      color: rgb(0.13, 0.77, 0.51),
    });
  }

  page.drawText(`ID: ${employee.id.slice(0, 8)}`, {
    x: margin,
    y: contentY + mmToPt(0.5),
    size: 5,
    font: fontMono,
    color: cBorder,
  });

  // =========================================================
  // BACK PAGE (PHOTO) - keep as-is from previous version
  // =========================================================
  const backPage = pdf.addPage([W, H]);

  // Background + border
  backPage.drawRectangle({ x: 0, y: 0, width: W, height: H, color: cBg });
  backPage.drawRectangle({
    x: mmToPt(0.5),
    y: mmToPt(0.5),
    width: W - mmToPt(1),
    height: H - mmToPt(1),
    borderWidth: 1.3,
    borderColor: cBorder,
  });

  // Back header (light)
  backPage.drawRectangle({
    x: mmToPt(0.5),
    y: headerY,
    width: W - mmToPt(1),
    height: headerH,
    color: cHeaderBg,
  });

  // Accent strip
  backPage.drawRectangle({
    x: mmToPt(0.5),
    y: H - mmToPt(0.5) - mmToPt(1.6),
    width: W - mmToPt(1),
    height: mmToPt(1.6),
    color: cAccent,
  });

  if (logo) {
    backPage.drawImage(logo, {
      x: margin,
      y: headerY + (headerH - logoH) / 2,
      width: logoW,
      height: logoH,
    });
  } else {
    backPage.drawText("FIRSTCLASS PROJECTS", {
      x: margin,
      y: headerY + mmToPt(5),
      size: 11,
      font: fontBold,
      color: cText,
    });
  }

  // Photo block
  const photoBoxW = mmToPt(28);
  const photoBoxH = mmToPt(36);
  const photoBoxX = margin;
  const photoBoxY = headerY - mmToPt(6) - photoBoxH;

  let photoImg = employee.faceImageUrl
    ? await embedEmployeePhoto(pdf, employee.faceImageUrl)
    : null;

  if (!photoImg) {
    photoImg = await embedFallbackEmployeeImage(pdf);
  }

  if (photoImg) {
    backPage.drawRectangle({
      x: photoBoxX - mmToPt(0.8),
      y: photoBoxY - mmToPt(0.8),
      width: photoBoxW + mmToPt(1.6),
      height: photoBoxH + mmToPt(1.6),
      borderWidth: 1,
      borderColor: cBorder,
      color: rgb(1, 1, 1),
    });

    backPage.drawImage(photoImg, {
      x: photoBoxX,
      y: photoBoxY,
      width: photoBoxW,
      height: photoBoxH,
    });
  } else {
    backPage.drawRectangle({
      x: photoBoxX,
      y: photoBoxY,
      width: photoBoxW,
      height: photoBoxH,
      borderWidth: 1.5,
      borderColor: cAccent,
      color: rgb(0.97, 0.98, 1),
    });
    backPage.drawText("No Photo", {
      x: photoBoxX + mmToPt(6),
      y: photoBoxY + photoBoxH / 2 - mmToPt(2),
      size: 10,
      font: fontBold,
      color: cTextMuted,
    });
  }

  const rightX = photoBoxX + photoBoxW + mmToPt(6);
  const nameTopY = photoBoxY + photoBoxH - mmToPt(4);

  drawTextFit({
    page: backPage,
    text: fullName,
    x: rightX,
    y: nameTopY,
    size: 12.5,
    font: fontBold,
    color: cText,
    maxWidth: W - rightX - margin,
  });

  backPage.drawText(`ID: ${employee.id.slice(0, 8)}`, {
    x: rightX,
    y: nameTopY - mmToPt(8),
    size: 8.5,
    font: fontMono,
    color: cTextMuted,
  });

  backPage.drawText("This photo is used for admin verification.", {
    x: rightX,
    y: nameTopY - mmToPt(14),
    size: 7,
    font,
    color: cTextLight,
  });

  const cFooter = rgb(0.02, 0.11, 0.23);
  const footerH = mmToPt(10);

  backPage.drawRectangle({
    x: 0,
    y: 0,
    width: W,
    height: footerH,
    color: cFooter,
  });

  backPage.drawText(
    `© ${new Date().getFullYear()} Firstclass Projects. All rights reserved.`,
    {
      x: margin,
      y: mmToPt(3),
      size: 6.8,
      font,
      color: rgb(1, 1, 1),
    },
  );

  // Save PDF
  const pdfBytes = await pdf.save();

  const ab = new ArrayBuffer(pdfBytes.byteLength);
  new Uint8Array(ab).set(pdfBytes as unknown as Uint8Array);

  return new Response(ab, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="worker-card-${employee.id}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
