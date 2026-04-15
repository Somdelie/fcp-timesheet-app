"use client";

import { useEffect, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";
import { TaskColumn } from "./task-column";
import { TaskCard } from "./task-card";
import { AddTaskDialog } from "./add-task-dialog";
import { ViewTaskDialog } from "./view-task-dialog";
import type { Task } from "@/lib/types";
import {
  getSchedulerTasks,
  createSchedulerTask,
  updateSchedulerTaskColumn,
  deleteSchedulerTask,
  updateSchedulerTask,
} from "@/actions/scheduler";

const columns = [
  { id: "todo", title: "To Do" },
  { id: "in-progress", title: "In Progress" },
  { id: "done", title: "Done" },
];

export function SchedulerBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [viewTask, setViewTask] = useState<Task | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const data = await getSchedulerTasks();
      setTasks(data);
    });
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeTask = tasks.find((t) => t.id === activeId);
    const overTask = tasks.find((t) => t.id === overId);

    if (!activeTask) return;

    // If dropping over a column
    if (columns.some((c) => c.id === overId)) {
      if (activeTask.column !== overId) {
        setTasks((tasks) =>
          tasks.map((t) => (t.id === activeId ? { ...t, column: overId } : t)),
        );
      }
      return;
    }

    // If dropping over another task
    if (overTask && activeTask.column !== overTask.column) {
      setTasks((tasks) =>
        tasks.map((t) =>
          t.id === activeId ? { ...t, column: overTask.column } : t,
        ),
      );
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeTaskItem = tasks.find((t) => t.id === activeId);
    if (!activeTaskItem) return;

    // Persist the column change to the server
    startTransition(async () => {
      await updateSchedulerTaskColumn(activeId, activeTaskItem.column);
    });

    if (activeId === overId) return;

    const overTask = tasks.find((t) => t.id === overId);

    // If dropping over same column, reorder
    if (overTask && activeTaskItem.column === overTask.column) {
      const columnTasks = tasks.filter(
        (t) => t.column === activeTaskItem.column,
      );
      const oldIndex = columnTasks.findIndex((t) => t.id === activeId);
      const newIndex = columnTasks.findIndex((t) => t.id === overId);

      const reorderedColumnTasks = arrayMove(columnTasks, oldIndex, newIndex);
      const otherTasks = tasks.filter(
        (t) => t.column !== activeTaskItem.column,
      );

      setTasks([...otherTasks, ...reorderedColumnTasks]);
    }
  };

  const handleAddTask = (newTask: Omit<Task, "id">) => {
    startTransition(async () => {
      const created = await createSchedulerTask(newTask);
      setTasks((prev) => [...prev, created]);
    });
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    startTransition(async () => {
      await deleteSchedulerTask(taskId);
    });
  };

  const handleUpdateTask = (
    taskId: string,
    data: Partial<Omit<Task, "id">>,
  ) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...data } : t)),
    );
    setViewTask((prev) => (prev?.id === taskId ? { ...prev, ...data } : prev));
    startTransition(async () => {
      await updateSchedulerTask(taskId, data);
    });
  };

  const getTasksByColumn = (columnId: string) =>
    tasks.filter((t) => t.column === columnId);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div
        className="flex flex-col h-full rounded overflow-hidden"
        style={{
          backgroundImage: "url('/note-bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="flex items-center justify-between mb-6 px-6 pt-6 bg-white/70 backdrop-blur-sm dark:bg-black/50">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Schedule</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Drag and drop tasks between columns
            </p>
          </div>
          <AddTaskDialog onAddTask={handleAddTask} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 px-6 pb-6 overflow-auto bg-white/50 backdrop-blur-sm dark:bg-black/30">
          {columns.map((column) => (
            <TaskColumn
              key={column.id}
              id={column.id}
              title={column.title}
              tasks={getTasksByColumn(column.id)}
              count={getTasksByColumn(column.id).length}
              onDeleteTask={handleDeleteTask}
              onViewTask={setViewTask}
            />
          ))}
        </div>
      </div>

      <DragOverlay>
        {activeTask ? <TaskCard task={activeTask} isDragging /> : null}
      </DragOverlay>

      <ViewTaskDialog
        task={viewTask}
        open={!!viewTask}
        onOpenChange={(open) => !open && setViewTask(null)}
        onUpdate={handleUpdateTask}
      />
    </DndContext>
  );
}
