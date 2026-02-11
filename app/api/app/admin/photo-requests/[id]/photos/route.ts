import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAdminFromRequest(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (token) {
    const payload = await verifyApiToken(token);
    if (payload && payload.role === "ADMIN") {
      return { id: payload.sub as string, role: "ADMIN" as const };
    }
  }

  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;

  if (session?.user && role === "ADMIN") {
    return { id: (session.user as any).id as string, role: "ADMIN" as const };
  }

  return null;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: requestId } = await ctx.params;

  const photoRequest = await prisma.siteDayPhotoRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      status: true,
      requestedAt: true,
      dueAt: true,
      note: true,
      siteDay: {
        select: {
          id: true,
          workDate: true,
          site: { select: { id: true, name: true, code: true } },
        },
      },
      siteDayPhotos: {
        select: {
          id: true,
          imageUrl: true,
          uploadedAt: true,
          uploadedByUser: { select: { id: true, name: true, email: true } },
        },
        orderBy: { uploadedAt: "desc" },
      },
    },
  });

  if (!photoRequest) {
    return NextResponse.json(
      { error: "Photo request not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    request: {
      id: photoRequest.id,
      status: photoRequest.status,
      requestedAt: photoRequest.requestedAt.toISOString(),
      dueAt: photoRequest.dueAt?.toISOString() ?? null,
      note: photoRequest.note,
      siteDay: {
        id: photoRequest.siteDay.id,
        workDate: photoRequest.siteDay.workDate.toISOString().slice(0, 10),
        site: photoRequest.siteDay.site,
      },
    },
    photos: photoRequest.siteDayPhotos.map((p) => ({
      id: p.id,
      imageUrl: p.imageUrl,
      uploadedAt: p.uploadedAt.toISOString(),
      uploadedBy: p.uploadedByUser
        ? {
            id: p.uploadedByUser.id,
            name: p.uploadedByUser.name,
            email: p.uploadedByUser.email,
          }
        : null,
    })),
  });
}
