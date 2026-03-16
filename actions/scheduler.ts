"use server";

import { prisma } from "@/lib/prisma";
import { requireServerAuth } from "@/lib/auth-server";
import { revalidatePath } from "next/cache";
import type { Task, TaskCategory, TaskPriority } from "@/lib/types";

const categoryMap: Record<string, string> = {
  meeting: "MEETING",
  todo: "TODO",
  reminder: "REMINDER",
  event: "EVENT",
};

const categoryReverseMap: Record<string, TaskCategory> = {
  MEETING: "meeting",
  TODO: "todo",
  REMINDER: "reminder",
  EVENT: "event",
};

const priorityMap: Record<string, string> = {
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
};

const priorityReverseMap: Record<string, TaskPriority> = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
};

function toClientTask(t: {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  time: string | null;
  date: Date;
  column: string;
}): Task {
  return {
    id: t.id,
    title: t.title,
    description: t.description ?? undefined,
    category: categoryReverseMap[t.category] ?? "todo",
    priority: priorityReverseMap[t.priority] ?? "medium",
    time: t.time ?? undefined,
    date: t.date.toISOString().split("T")[0],
    column: t.column,
  };
}

export async function getSchedulerTasks(): Promise<Task[]> {
  const auth = await requireServerAuth();
  const tasks = await prisma.schedulerTask.findMany({
    where: { userId: auth.userId },
    orderBy: [{ column: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return tasks.map(toClientTask);
}

export async function createSchedulerTask(
  input: Omit<Task, "id">,
): Promise<Task> {
  const auth = await requireServerAuth();
  const task = await prisma.schedulerTask.create({
    data: {
      userId: auth.userId,
      title: input.title,
      description: input.description ?? null,
      category: (categoryMap[input.category] ?? "TODO") as any,
      priority: (priorityMap[input.priority] ?? "MEDIUM") as any,
      time: input.time ?? null,
      date: new Date(input.date + "T00:00:00.000Z"),
      column: input.column,
    },
  });
  revalidatePath("/scheduler");
  return toClientTask(task);
}

export async function updateSchedulerTaskColumn(
  taskId: string,
  column: string,
  sortOrder?: number,
): Promise<void> {
  const auth = await requireServerAuth();
  await prisma.schedulerTask.updateMany({
    where: { id: taskId, userId: auth.userId },
    data: { column, ...(sortOrder !== undefined ? { sortOrder } : {}) },
  });
}

export async function deleteSchedulerTask(taskId: string): Promise<void> {
  const auth = await requireServerAuth();
  await prisma.schedulerTask.deleteMany({
    where: { id: taskId, userId: auth.userId },
  });
  revalidatePath("/scheduler");
}
