import { NextRequest, NextResponse } from "next/server";
import { deleteUserById } from "@/actions/user";
import { requireAuth } from "@/lib/auth";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Only admins can delete users
  await requireAuth({ roles: ["ADMIN"] });

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing user id" }, { status: 400 });
  }

  const res = await deleteUserById(id);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
