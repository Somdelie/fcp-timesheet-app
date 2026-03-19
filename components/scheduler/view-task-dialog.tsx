"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  Clock,
  CalendarDays,
  Users,
  CheckCircle2,
  Bell,
  Flame,
  Minus,
  ArrowDown,
  AlignLeft,
  CalendarIcon,
  Pencil,
  Save,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { TimePicker } from "@/components/ui/time-picker";
import { cn } from "@/lib/utils";
import type { Task, TaskCategory, TaskPriority } from "@/lib/types";

const categoryConfig = {
  meeting: {
    icon: Users,
    label: "Meeting",
    color: "text-sky-500",
    bg: "bg-sky-500/10",
    border: "border-sky-500/30",
  },
  todo: {
    icon: CheckCircle2,
    label: "To-Do",
    color: "text-violet-500",
    bg: "bg-violet-500/10",
    border: "border-violet-500/30",
  },
  reminder: {
    icon: Bell,
    label: "Reminder",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
  },
  event: {
    icon: CalendarDays,
    label: "Event",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
  },
};

const priorityConfig = {
  low: {
    icon: ArrowDown,
    label: "Low",
    color: "text-slate-400",
    bg: "bg-slate-500/10",
  },
  medium: {
    icon: Minus,
    label: "Medium",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  high: {
    icon: Flame,
    label: "High",
    color: "text-rose-400",
    bg: "bg-rose-500/10",
  },
};

const columnLabels: Record<string, { label: string; color: string }> = {
  todo: { label: "To Do", color: "bg-muted text-muted-foreground" },
  "in-progress": { label: "In Progress", color: "bg-primary/10 text-primary" },
  done: { label: "Done", color: "bg-emerald-500/10 text-emerald-500" },
};

interface ViewTaskDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: (taskId: string, data: Partial<Omit<Task, "id">>) => void;
}

export function ViewTaskDialog({
  task,
  open,
  onOpenChange,
  onUpdate,
}: ViewTaskDialogProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [editCategory, setEditCategory] = useState<TaskCategory>("todo");
  const [editPriority, setEditPriority] = useState<TaskPriority>("medium");
  const [time, setTime] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [editColumn, setEditColumn] = useState("todo");

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setEditCategory(task.category);
      setEditPriority(task.priority);
      setTime(task.time || "");
      setDate(new Date(task.date + "T00:00:00"));
      setEditColumn(task.column);
      setEditing(false);
    }
  }, [task]);

  if (!task) return null;

  const catKey = editing ? editCategory : task.category;
  const priKey = editing ? editPriority : task.priority;
  const colKey = editing ? editColumn : task.column;

  const category = categoryConfig[catKey];
  const priority = priorityConfig[priKey];
  const column = columnLabels[colKey] ?? {
    label: colKey,
    color: "bg-muted text-muted-foreground",
  };
  const CategoryIcon = category.icon;
  const PriorityIcon = priority.icon;

  const dateFormatted = (() => {
    try {
      return format(new Date(task.date + "T00:00:00"), "EEEE, d MMMM yyyy");
    } catch {
      return task.date;
    }
  })();

  const handleSave = () => {
    if (!title.trim()) return;
    onUpdate?.(task.id, {
      title,
      description: description || undefined,
      category: editCategory,
      priority: editPriority,
      time: time || undefined,
      date: format(date, "yyyy-MM-dd"),
      column: editColumn,
    });
    setEditing(false);
  };

  const handleCancel = () => {
    setTitle(task.title);
    setDescription(task.description || "");
    setEditCategory(task.category);
    setEditPriority(task.priority);
    setTime(task.time || "");
    setDate(new Date(task.date + "T00:00:00"));
    setEditColumn(task.column);
    setEditing(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className={cn("px-6 pt-6 pb-4", category.bg)}>
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "p-2.5 rounded shrink-0",
                  category.bg,
                  category.border,
                  "border",
                )}
              >
                <CategoryIcon className={cn("size-5", category.color)} />
              </div>
              <div className="flex-1 min-w-0">
                {editing ? (
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Task title"
                    className="text-lg font-semibold bg-background/50 border-border"
                  />
                ) : (
                  <DialogTitle className="text-lg font-semibold text-foreground leading-snug">
                    {task.title}
                  </DialogTitle>
                )}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      category.bg,
                      category.color,
                      category.border,
                    )}
                  >
                    {category.label}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn("text-xs", priority.bg, priority.color)}
                  >
                    <PriorityIcon className="size-3 mr-1" />
                    {priority.label}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn("text-xs", column.color)}
                  >
                    {column.label}
                  </Badge>
                </div>
              </div>
              {/* Edit / Save / Cancel */}
              <div className="flex items-center gap-1 shrink-0">
                {editing ? (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCancel}
                      className="h-8 w-8 p-0 text-muted-foreground"
                    >
                      <X className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSave}
                      className="h-8 gap-1.5 px-3"
                    >
                      <Save className="size-3.5" />
                      Save
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditing(true)}
                    className="h-8 gap-1.5 px-3 text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="size-3.5" />
                    Edit
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {editing ? (
            <>
              {/* Description */}
              <div className="grid gap-2">
                <Label htmlFor="edit-desc">Description</Label>
                <Textarea
                  id="edit-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a description..."
                  rows={3}
                  className="bg-input border-border resize-none"
                />
              </div>

              {/* Category & Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Category</Label>
                  <Select
                    value={editCategory}
                    onValueChange={(v) => setEditCategory(v as TaskCategory)}
                  >
                    <SelectTrigger className="bg-input border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo">To-Do</SelectItem>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="reminder">Reminder</SelectItem>
                      <SelectItem value="event">Event</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Priority</Label>
                  <Select
                    value={editPriority}
                    onValueChange={(v) => setEditPriority(v as TaskPriority)}
                  >
                    <SelectTrigger className="bg-input border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Status */}
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={editColumn} onValueChange={setEditColumn}>
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal bg-input border-border",
                          !date && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={(d) => d && setDate(d)}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="grid gap-2">
                  <Label>Time</Label>
                  <TimePicker value={time} onChange={setTime} />
                </div>
              </div>
            </>
          ) : (
            <>
              {/* View mode: Description */}
              {task.description ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <AlignLeft className="size-3.5" />
                    Description
                  </div>
                  <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap pl-5.5">
                    {task.description}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-muted-foreground/60 italic pl-0.5">
                  <AlignLeft className="size-3.5" />
                  No description
                </div>
              )}

              {/* View mode: Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <CalendarIcon className="size-3.5" />
                    Date
                  </div>
                  <p className="text-sm text-foreground font-medium pl-5.5">
                    {dateFormatted}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <Clock className="size-3.5" />
                    Time
                  </div>
                  <p className="text-sm text-foreground font-medium pl-5.5">
                    {task.time || "Not set"}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
