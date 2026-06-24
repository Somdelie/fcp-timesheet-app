import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAuth(req: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user) return { id: (session.user as any).id as string };
  return null;
}

function encodeEvent(data: string) {
  return `data: ${data}\n\n`;
}

export async function GET(req: Request) {
  const auth = await getAuth(req);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const textEncoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const sendInvites = async () => {
        try {
          const invites = await prisma.noteInvite.findMany({
            where: { invitedUserId: auth.id, status: "PENDING" },
            include: {
              invitedByUser: { select: { id: true, name: true } },
              note: { select: { id: true, title: true } },
            },
            orderBy: { createdAt: "desc" },
          });

          if (invites.length > 0) {
            const payload = JSON.stringify(
              invites.map((inv) => ({
                id: inv.id,
                noteId: inv.noteId,
                invitedBy: {
                  id: inv.invitedByUser?.id,
                  name: inv.invitedByUser?.name,
                },
                noteTitle: inv.note?.title ?? null,
                createdAt: inv.createdAt,
              })),
            );
            controller.enqueue(textEncoder.encode(encodeEvent(payload)));
          }
        } catch (err) {
          // ignore errors but don't close stream
        }
      };

      // Send an initial comment to establish connection
      controller.enqueue(textEncoder.encode(":ok\n\n"));

      // Poll every 5s on the server and push events when invites exist
      const interval = setInterval(sendInvites, 5000);

      // Also run once immediately
      await sendInvites();

      // Close when client disconnects
      const abortHandler = () => {
        if (closed) return;
        closed = true;
        clearInterval(interval);
        controller.close();
      };

      // Next.js exposes the request signal for abort
      try {
        (req as any).signal.addEventListener("abort", abortHandler);
      } catch {
        // ignore if not available
      }
    },
    cancel() {
      // no-op
    },
  });

  const headers = new Headers({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  return new NextResponse(stream, { headers });
}
