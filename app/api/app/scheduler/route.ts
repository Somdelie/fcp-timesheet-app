import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

async function getAuth(req: Request) {
  const h = req.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : null;
  if (token) {
    const p = await verifyApiToken(token);
    if (p) return { id: p.sub, role: p.role };
  }
  const session = await getServerSession(authOptions);
  if (session?.user) {
    return {
      id: (session.user as any).id as string,
      role: (session.user as any).role as string,
    };
  }
  return null;
}

const categoryReverseMap: Record<string, string> = {
  MEETING: "meeting",
  TODO: "todo",
  REMINDER: "reminder",
  EVENT: "event",
};
const priorityReverseMap: Record<string, string> = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
};

function toClient(t: any) {
  return {
    id: t.id,
    title: t.title,
    description: t.description ?? undefined,
    category: categoryReverseMap[t.category] ?? "todo",
    priority: priorityReverseMap[t.priority] ?? "medium",
    time: t.time ?? undefined,
    date: t.date instanceof Date ? t.date.toISOString().split("T")[0] : t.date,
    column: t.column,
  };
}

/** GET /api/app/scheduler – list tasks for the current user */
export async function GET(req: Request) {
  const auth = await getAuth(req);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });

  const tasks = await prisma.schedulerTask.findMany({
    where: { userId: auth.id },
    orderBy: [{ column: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ tasks: tasks.map(toClient) }, { headers: CORS });
}

const categoryMap: Record<string, string> = {
  meeting: "MEETING",
  todo: "TODO",
  reminder: "REMINDER",
  event: "EVENT",
};
const priorityMap: Record<string, string> = {
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
};

/** POST /api/app/scheduler – create a task */
export async function POST(req: Request) {
  const auth = await getAuth(req);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });

  const body = await req.json();
  const { title, description, category, priority, time, date, column } = body;

  if (!title?.trim())
    return NextResponse.json({ error: "Title is required" }, { status: 400, headers: CORS });

  const task = await prisma.schedulerTask.create({
    data: {
      userId: auth.id,
      title: title.trim(),
      description: description || null,
      category: (categoryMap[category] ?? "TODO") as any,
      priority: (priorityMap[priority] ?? "MEDIUM") as any,
      time: time || null,
      date: new Date(date + "T00:00:00.000Z"),
      column: column || "todo",
    },
  });

  return NextResponse.json({ task: toClient(task) }, { status: 201, headers: CORS });
}
