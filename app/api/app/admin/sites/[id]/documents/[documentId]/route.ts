import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { verifyApiToken } from "@/lib/jwt";
import { deleteCloudinaryResource } from "@/lib/cloudinary";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

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

function encodeContentDispositionFileName(fileName: string) {
  const fallback = fileName.replace(/[^\w.\- ]+/g, "_").trim() || "document";
  const encoded = encodeURIComponent(fileName).replace(/['()]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string; documentId: string }> },
) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS },
      );

    const { id, documentId } = await ctx.params;
    const doc = await prisma.siteDocument.findFirst({
      where: { id: documentId, siteId: id },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        fileSize: true,
        fileUrl: true,
      },
    });

    if (!doc)
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404, headers: CORS },
      );

    const upstream = await fetch(doc.fileUrl);
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: "Could not fetch document file" },
        { status: upstream.status || 502, headers: CORS },
      );
    }

    const download = new URL(req.url).searchParams.get("download") === "1";
    const headers = new Headers(CORS);
    headers.set("Content-Type", doc.mimeType || "application/octet-stream");
    headers.set("Content-Length", String(doc.fileSize));
    headers.set(
      "Content-Disposition",
      `${download ? "attachment" : "inline"}; ${encodeContentDispositionFileName(doc.fileName)}`,
    );
    headers.set("Cache-Control", "private, max-age=300");

    return new Response(upstream.body, { status: 200, headers });
  } catch (error) {
    console.error("GET site document file error:", error);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string; documentId: string }> },
) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS },
      );

    const { id, documentId } = await ctx.params;
    const doc = await prisma.siteDocument.findFirst({
      where: { id: documentId, siteId: id },
      select: {
        id: true,
        cloudinaryPublicId: true,
        cloudinaryResourceType: true,
      },
    });

    if (!doc)
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404, headers: CORS },
      );

    await prisma.siteDocument.delete({ where: { id: doc.id } });

    if (doc.cloudinaryPublicId) {
      await deleteCloudinaryResource(
        doc.cloudinaryPublicId,
        (doc.cloudinaryResourceType as "image" | "video" | "raw" | "auto") ??
          "raw",
      );
    }

    return NextResponse.json({ ok: true }, { headers: CORS });
  } catch (error) {
    console.error("DELETE site document error:", error);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}
