import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { verifyApiToken } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";
import { getSecureUrl, uploadImageFile } from "@/lib/cloudinary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const MAX_SIZE = 25 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/csv",
  "text/plain",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const DOCUMENT_TYPES = new Set([
  "DRAWING",
  "SPEC",
  "QUOTE",
  "INVOICE",
  "EXCEL",
  "PHOTO",
  "OTHER",
]);

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

async function getAuth(req: Request) {
  const h = req.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : null;
  if (token) {
    const p = await verifyApiToken(token);
    if (
      p &&
      (p.role === "ADMIN" || p.role === "OFFICE" || p.role === "SUPERVISOR")
    ) {
      return { id: p.sub, role: p.role as string };
    }
  }

  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  if (
    session?.user &&
    (role === "ADMIN" || role === "OFFICE" || role === "SUPERVISOR")
  ) {
    return { id: (session.user as any).id as string, role };
  }

  return null;
}

function inferDocumentType(file: File, requested: string | null) {
  const normalized = (requested ?? "").trim().toUpperCase();
  if (DOCUMENT_TYPES.has(normalized)) return normalized;
  const lowerName = file.name.toLowerCase();
  if (file.type === "application/pdf") return "DRAWING";
  if (file.type.includes("spreadsheet") || lowerName.endsWith(".xls") || lowerName.endsWith(".xlsx") || lowerName.endsWith(".csv")) return "EXCEL";
  if (file.type.startsWith("image/")) return "PHOTO";
  if (lowerName.includes("spec")) return "SPEC";
  return "OTHER";
}

function cloudinaryResourceTypeFor(file: File): "image" | "raw" {
  return file.type.startsWith("image/") ? "image" : "raw";
}

function serialize(doc: {
  id: string;
  title: string;
  fileName: string;
  documentType: string;
  mimeType: string;
  fileSize: number;
  fileUrl: string;
  createdAt: Date;
  uploadedByUser: { id: string; name: string | null; email: string | null } | null;
}) {
  return {
    id: doc.id,
    title: doc.title,
    fileName: doc.fileName,
    documentType: doc.documentType,
    mimeType: doc.mimeType,
    fileSize: doc.fileSize,
    fileUrl: doc.fileUrl,
    createdAt: doc.createdAt.toISOString(),
    uploadedBy: doc.uploadedByUser
      ? {
          id: doc.uploadedByUser.id,
          name: doc.uploadedByUser.name,
          email: doc.uploadedByUser.email,
        }
      : null,
  };
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS },
      );

    const { id } = await ctx.params;
    const site = await prisma.site.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!site)
      return NextResponse.json(
        { error: "Site not found" },
        { status: 404, headers: CORS },
      );

    const documents = await prisma.siteDocument.findMany({
      where: { siteId: id },
      orderBy: { createdAt: "desc" },
      include: {
        uploadedByUser: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json(
      { documents: documents.map(serialize) },
      { headers: CORS },
    );
  } catch (error) {
    console.error("GET site documents error:", error);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS },
      );

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.startsWith("multipart/form-data")) {
      return NextResponse.json(
        { error: "Expected multipart/form-data" },
        { status: 400, headers: CORS },
      );
    }

    const { id } = await ctx.params;
    const site = await prisma.site.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!site)
      return NextResponse.json(
        { error: "Site not found" },
        { status: 404, headers: CORS },
      );

    const formData = await req.formData();
    const files = formData
      .getAll("files")
      .filter((item): item is File => item instanceof File);
    const singleFile = formData.get("file");
    if (singleFile instanceof File) files.push(singleFile);

    if (files.length === 0) {
      return NextResponse.json(
        { error: "Missing file" },
        { status: 400, headers: CORS },
      );
    }

    const titleRaw = String(formData.get("title") ?? "").trim();
    const typeRaw = String(formData.get("documentType") ?? "").trim();
    const created = [];

    for (const file of files) {
      if (file.size > MAX_SIZE) {
        return NextResponse.json(
          { error: `${file.name} is too large. Max 25 MB per file.` },
          { status: 400, headers: CORS },
        );
      }
      if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
        return NextResponse.json(
          { error: `${file.name} is not a supported document type.` },
          { status: 400, headers: CORS },
        );
      }

      const resourceType = cloudinaryResourceTypeFor(file);
      const upload = await uploadImageFile(file, {
        folder: `site-documents/${id}`,
        resource_type: resourceType,
        use_filename: true,
        unique_filename: true,
      });

      const doc = await prisma.siteDocument.create({
        data: {
          siteId: id,
          title: titleRaw || file.name.replace(/\.[^.]+$/, ""),
          fileName: file.name,
          documentType: inferDocumentType(file, typeRaw),
          mimeType: file.type || "application/octet-stream",
          fileSize: file.size,
          fileUrl: getSecureUrl(upload),
          cloudinaryPublicId: upload.public_id,
          cloudinaryResourceType: upload.resource_type,
          uploadedByUserId: auth.id,
        },
        include: {
          uploadedByUser: { select: { id: true, name: true, email: true } },
        },
      });
      created.push(serialize(doc));
    }

    return NextResponse.json({ documents: created }, { headers: CORS });
  } catch (error) {
    console.error("POST site documents error:", error);
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: CORS },
    );
  }
}
