export type TaskCategory = "meeting" | "todo" | "reminder" | "event";

export type TaskPriority = "low" | "medium" | "high";

export interface Task {
  id: string;
  title: string;
  description?: string;
  category: TaskCategory;
  priority: TaskPriority;
  time?: string;
  date: string;
  column: string;
}

export interface Column {
  id: string;
  title: string;
  tasks: Task[];
}
