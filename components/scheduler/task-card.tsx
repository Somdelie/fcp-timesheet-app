"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Clock,
  GripVertical,
  CalendarDays,
  Users,
  CheckCircle2,
  Bell,
  Trash2,
  ChevronRight,
  Flame,
  Minus,
  ArrowDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types";

interface TaskCardProps {
  task: Task;
  isDragging?: boolean;
  onDelete?: (id: string) => void;
  onClick?: (task: Task) => void;
}

const categoryConfig = {
  meeting: {
    icon: Users,
    label: "Meeting",
    accent: "from-sky-500/20 to-cyan-500/10 border-sky-500/25",
    iconBg: "bg-sky-500/15 text-sky-400",
    dot: "bg-sky-400",
  },
  todo: {
    icon: CheckCircle2,
    label: "To-Do",
    accent: "from-violet-500/20 to-purple-500/10 border-violet-500/25",
    iconBg: "bg-violet-500/15 text-violet-400",
    dot: "bg-violet-400",
  },
  reminder: {
    icon: Bell,
    label: "Reminder",
    accent: "from-amber-500/20 to-orange-500/10 border-amber-500/25",
    iconBg: "bg-amber-500/15 text-amber-400",
    dot: "bg-amber-400",
  },
  event: {
    icon: CalendarDays,
    label: "Event",
    accent: "from-emerald-500/20 to-teal-500/10 border-emerald-500/25",
    iconBg: "bg-emerald-500/15 text-emerald-400",
    dot: "bg-emerald-400",
  },
};

const priorityConfig = {
  low: {
    icon: ArrowDown,
    label: "Low",
    color: "text-slate-400",
    bg: "bg-slate-500/10",
    bar: "bg-slate-500/40",
  },
  medium: {
    icon: Minus,
    label: "Med",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    bar: "bg-amber-400",
  },
  high: {
    icon: Flame,
    label: "High",
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    bar: "bg-rose-400",
  },
};

export function TaskCard({
  task,
  isDragging,
  onDelete,
  onClick,
}: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const category = categoryConfig[task.category];
  const priority = priorityConfig[task.priority];
  const Icon = category.icon;
  const PriorityIcon = priority.icon;

  const isActive = isDragging || isSortableDragging;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("group relative", isActive && "z-50")}
    >
      {/* Glow effect on hover */}
      <div
        className={cn(
          "absolute -inset-0.5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm",
          `bg-linear-to-br ${category.accent}`,
        )}
      />

      <Card
        className={cn(
          "relative cursor-grab active:cursor-grabbing",
          "border bg-linear-to-br backdrop-blur-sm p-0",
          "transition-all duration-200",
          `${category.accent}`,
          "hover:shadow-lg hover:-translate-y-0.5",
          isActive && "opacity-60 rotate-1 scale-105 shadow-2xl",
          "bg-card/90",
        )}
        onClick={() => onClick?.(task)}
      >
        {/* Priority left border bar */}
        <div
          className={cn(
            "absolute left-0 top-3 bottom-3 w-0.5 rounded-full",
            priority.bar,
          )}
        />

        <CardContent className="p-3.5 pl-4">
          {/* Header row */}
          <div className="flex items-start gap-2.5">
            {/* Drag handle */}
            <div
              {...attributes}
              {...listeners}
              className="mt-0.5 opacity-0 group-hover:opacity-60 hover:opacity-100! transition-opacity shrink-0 touch-none"
            >
              <GripVertical className="size-3.5 text-muted-foreground" />
            </div>

            {/* Category icon */}
            <div
              className={cn(
                "p-1.5 rounded-lg shrink-0 mt-0.5",
                category.iconBg,
              )}
            >
              <Icon className="size-3" />
            </div>

            {/* Title & meta */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-1 mb-1">
                <h3 className="font-semibold text-[13px] text-foreground leading-snug truncate">
                  {task.title}
                </h3>
                {onDelete && (
                  <button
                    onClick={() => onDelete(task.id)}
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-150 p-1 rounded-md text-muted-foreground/60 hover:bg-destructive/15 hover:text-destructive"
                    aria-label="Delete task"
                  >
                    <Trash2 className="size-3" />
                  </button>
                )}
              </div>

              {task.description && (
                <p className="text-[11px] text-muted-foreground/80 line-clamp-2 leading-relaxed mb-2">
                  {task.description}
                </p>
              )}

              {/* Footer row */}
              <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-border/30">
                <div className="flex items-center gap-2">
                  {/* Category chip */}
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                      category.iconBg,
                    )}
                  >
                    <span className={cn("size-1 rounded-full", category.dot)} />
                    {category.label}
                  </span>

                  {/* Priority chip */}
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                      priority.bg,
                      priority.color,
                    )}
                  >
                    <PriorityIcon className="size-2.5" />
                    {priority.label}
                  </span>
                </div>

                {/* Time */}
                {task.time && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
                    <Clock className="size-2.5" />
                    <span className="font-mono tracking-tight">
                      {task.time}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
