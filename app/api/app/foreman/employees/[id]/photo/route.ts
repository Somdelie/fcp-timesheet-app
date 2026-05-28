import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { uploadImageFile, getSecureUrl } from "@/lib/cloudinary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const token = getBearer(req);
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await verifyApiToken(token);
    if (!payload || payload.role !== "FOREMAN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const foreman = await prisma.foreman.findUnique({
      where: { userId: payload.sub },
      select: { id: true },
    });
    if (!foreman)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await ctx.params;
    const employeeId = id;

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing file field in form-data" },
        { status: 400 },
      );
    }

    // Optional: ensure foreman has relationship to this employee
    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        foremanLinks: { some: { foremanId: foreman.id } },
      },
      select: { id: true },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    const upload = await uploadImageFile(file, { folder: "employees" });
    const url = getSecureUrl(upload);

    const updated = await prisma.employee.update({
      where: { id: employeeId },
      data: { faceImageUrl: url, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        faceImageUrl: true,
        isActive: true,
      },
    });

    return NextResponse.json({
      employee: updated,
      upload: {
        url,
        publicId: upload.public_id,
        width: upload.width,
        height: upload.height,
        format: upload.format,
      },
    });
  } catch (e: any) {
    console.error("Foreman employee photo upload error", e);
    return NextResponse.json(
      { error: e?.message ?? "Upload failed" },
      { status: 500 },
    );
  }
}
