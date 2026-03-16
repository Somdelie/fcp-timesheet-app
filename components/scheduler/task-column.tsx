"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import { TaskCard } from "./task-card";
import type { Task } from "@/lib/types";
import { CircleDashed, Loader2, CheckCheck, Plus } from "lucide-react";

interface TaskColumnProps {
  id: string;
  title: string;
  tasks: Task[];
  count: number;
  onDeleteTask?: (id: string) => void;
}

const columnConfig = {
  todo: {
    icon: CircleDashed,
    accent: "text-slate-400",
    countBg: "bg-slate-500/15 text-slate-400",
    headerBorder: "border-slate-500/20",
    dropGlow: "ring-slate-500/30 bg-slate-500/5",
    emptyText: "Nothing queued up yet",
    iconSpin: false,
  },
  "in-progress": {
    icon: Loader2,
    accent: "text-blue-400",
    countBg: "bg-blue-500/15 text-blue-400",
    headerBorder: "border-blue-500/20",
    dropGlow: "ring-blue-500/30 bg-blue-500/5",
    emptyText: "Drag tasks here to start",
    iconSpin: true,
  },
  done: {
    icon: CheckCheck,
    accent: "text-emerald-400",
    countBg: "bg-emerald-500/15 text-emerald-400",
    headerBorder: "border-emerald-500/20",
    dropGlow: "ring-emerald-500/30 bg-emerald-500/5",
    emptyText: "No completed tasks yet",
    iconSpin: false,
  },
};

export function TaskColumn({
  id,
  title,
  tasks,
  count,
  onDeleteTask,
}: TaskColumnProps) {
  const { isOver, setNodeRef } = useDroppable({ id });

  const config =
    columnConfig[id as keyof typeof columnConfig] ?? columnConfig.todo;
  const ColIcon = config.icon;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col min-h-60 max-h-[calc(100vh-220px)] rounded border border-border/40",
        "bg-linear-to-b from-secondary/40 to-secondary/20 backdrop-blur-sm",
        "transition-all duration-200",
        isOver && `ring-1 ${config.dropGlow}`,
      )}
    >
      {/* Column Header */}
      <div className={cn("px-4 pt-4 pb-3 border-b", config.headerBorder)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ColIcon
              className={cn(
                "size-4",
                config.accent,
                config.iconSpin && isOver && "animate-spin",
              )}
            />
            <h2 className="font-semibold text-sm tracking-tight text-foreground">
              {title}
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            {count > 0 && (
              <span
                className={cn(
                  "text-[11px] font-semibold px-2 py-0.5 rounded-full",
                  config.countBg,
                )}
              >
                {count}
              </span>
            )}
          </div>
        </div>

        {/* Progress dots */}
        {count > 0 && (
          <div className="flex gap-0.5 mt-2.5">
            {Array.from({ length: Math.min(count, 10) }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-0.5 flex-1 rounded-full transition-all duration-500",
                  config.accent
                    .replace("text-", "bg-")
                    .replace("-400", "-400/60"),
                )}
                style={{ animationDelay: `${i * 50}ms` }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Card list */}
      <div className="flex-1 p-3 overflow-y-auto">
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-2">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} onDelete={onDeleteTask} />
            ))}

            {tasks.length === 0 && (
              <div
                className={cn(
                  "flex flex-col items-center justify-center h-28 mt-1",
                  "border-2 border-dashed rounded transition-all duration-200",
                  isOver
                    ? "border-primary/40 bg-primary/5 scale-[0.99]"
                    : "border-border/30",
                )}
              >
                <Plus className="size-4 text-muted-foreground/30 mb-1" />
                <p className="text-xs text-muted-foreground/40 font-medium">
                  {config.emptyText}
                </p>
              </div>
            )}
          </div>
        </SortableContext>
      </div>

      {/* Footer summary */}
      {count > 0 && (
        <div className="px-4 py-2.5 border-t border-border/20">
          <p className="text-[10px] text-muted-foreground/40 font-medium tracking-wide uppercase">
            {count} {count === 1 ? "task" : "tasks"}
          </p>
        </div>
      )}
    </div>
  );
}
