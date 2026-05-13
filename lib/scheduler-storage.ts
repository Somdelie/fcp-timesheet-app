import type { Task } from "./types";

export const SCHEDULER_STORAGE_KEY = "fcp:scheduler:tasks";

export function getStoredTasks(): Task[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SCHEDULER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Task[]) : [];
  } catch {
    return [];
  }
}

export function setStoredTasks(tasks: Task[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SCHEDULER_STORAGE_KEY, JSON.stringify(tasks));
  } catch {}
}

export function patchStoredTask(taskId: string, patch: Partial<Task>): void {
  const tasks = getStoredTasks();
  setStoredTasks(tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)));
}
