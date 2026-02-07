import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { verifyApiToken } from "@/lib/jwt";
import { uploadImageFile, getSecureUrl } from "@/lib/cloudinary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

export async function POST(req: Request) {
  try {
    // Auth: allow either browser session (ADMIN/SUPERVISOR/FOREMAN)
    // or API token (any role encoded in JWT).
    let userId: string | null = null;
    let role: string | null = null;

    const token = getBearer(req);
    if (token) {
      const payload = await verifyApiToken(token);
      if (!payload)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      userId = payload.sub;
      role = payload.role;
    } else {
      const session = await getServerSession(authOptions);
      const user = session?.user as any;
      userId = user?.id ?? null;
      role = user?.role ?? null;
    }

    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.startsWith("multipart/form-data")) {
      return NextResponse.json(
        { error: "Expected multipart/form-data with a 'file' field" },
        { status: 400 },
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing file field in form-data" },
        { status: 400 },
      );
    }

    const folderRaw = String(formData.get("folder") ?? "").trim();
    const folder = (folderRaw || "misc") as any;

    const result = await uploadImageFile(file, { folder });

    return NextResponse.json({
      url: getSecureUrl(result),
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
    });
  } catch (e: any) {
    console.error("Cloudinary upload error", e);
    return NextResponse.json(
      { error: e?.message ?? "Upload failed" },
      { status: 500 },
    );
  }
}
