"use client";

import React, { useEffect, useState, useTransition } from "react";
import {
  Bell,
  CalendarClock,
  CheckCircle2,
  Clock,
  CloudRain,
  X,
  XCircle,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  getNotifications,
  type NotificationItem,
} from "@/actions/notifications";

export function NotificationSheet() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const persistOpened = (next: Set<string>) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        "notification-opened-ids",
        JSON.stringify(Array.from(next)),
      );
    } catch {
      // ignore storage errors
    }
  };

  const fetchNotifications = () => {
    startTransition(async () => {
      try {
        const data = await getNotifications();
        setNotifications(data);
      } catch {
        // silently ignore – user may not be authenticated yet
      }
    });
  };

  const dismissNotification = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
  };

  const clearAll = () => {
    const allIds = new Set(notifications.map((n) => n.id));
    setDismissed(allIds);
    setOpened(() => {
      persistOpened(allIds);
      return allIds;
    });
  };

  // Fetch on mount and when sheet opens
  useEffect(() => {
    fetchNotifications();
  }, []);

  // Load opened state from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("notification-opened-ids");
      if (!raw) return;
      const ids = JSON.parse(raw) as string[];
      if (Array.isArray(ids)) {
        setOpened(new Set(ids));
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  const handleOpen = () => {
    setOpen(true);
    fetchNotifications();
  };

  const visible = notifications.filter((n) => !dismissed.has(n.id));
  const count = visible.length;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="relative"
        onClick={handleOpen}
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
            {count}
          </span>
        )}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex h-full max-h-screen flex-col bg-background p-0"
        >
          <SheetHeader className="sticky top-0 z-10 border-b bg-background/95 px-4 py-4 backdrop-blur mt-4">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-lg">Notifications</SheetTitle>
              {count > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={clearAll}
                >
                  Clear all
                </Button>
              )}
            </div>
            <SheetDescription>
              Alerts for upcoming claim dates, scheduled tasks, and weather.
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1 overflow-y-auto px-4 py-3">
            {isPending && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                Loading…
              </div>
            ) : visible.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-sm text-muted-foreground">
                <Bell className="h-8 w-8 opacity-30" />
                <p>No notifications right now</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 pb-4">
                {visible.map((n) => (
                  <NotificationCard
                    key={n.id}
                    notification={n}
                    isOpened={opened.has(n.id)}
                    onOpen={() =>
                      setOpened((prev) => {
                        const next = new Set(prev).add(n.id);
                        persistOpened(next);
                        return next;
                      })
                    }
                    onDismiss={dismissNotification}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}

function NotificationCard({
  notification,
  isOpened,
  onOpen,
  onDismiss,
}: {
  notification: NotificationItem;
  isOpened: boolean;
  onOpen: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const isClaim = notification.type === "CLAIM_DUE";
  const isTask = notification.type === "TASK_DUE";
  const isWeather = notification.type === "WEATHER_ALERT";
  const isPhotoRejected = notification.type === "PHOTO_REJECTED";
  const isTimesheetSubmitted = notification.type === "TIMESHEET_SUBMITTED";
  const isTimesheetApproved = notification.type === "TIMESHEET_APPROVED";
  const isTimesheetRejected = notification.type === "TIMESHEET_REJECTED";

  const iconBg = isWeather
    ? "bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400"
    : isTimesheetRejected
      ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
      : isPhotoRejected
        ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
        : isTimesheetApproved
          ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
          : isTimesheetSubmitted
            ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
            : isTask
              ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
              : "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400";

  const icon = isWeather ? (
    <CloudRain className="h-4 w-4" />
  ) : isTimesheetRejected ? (
    <XCircle className="h-4 w-4" />
  ) : isPhotoRejected ? (
    <XCircle className="h-4 w-4" />
  ) : isTimesheetApproved ? (
    <CheckCircle2 className="h-4 w-4" />
  ) : isTimesheetSubmitted ? (
    <Clock className="h-4 w-4" />
  ) : isTask ? (
    <Clock className="h-4 w-4" />
  ) : (
    <CalendarClock className="h-4 w-4" />
  );

  const badgeLabel = isWeather
    ? "Weather"
    : isTimesheetRejected
      ? "Rejected"
      : isPhotoRejected
        ? "Photo issue"
        : isTimesheetApproved
          ? "Approved"
          : isTimesheetSubmitted
            ? "Pending"
            : isTask
              ? "Task"
              : isClaim
                ? "Claim"
                : "Alert";

  const badgeVariant: "outline" | "destructive" =
    isTimesheetRejected || isPhotoRejected ? "destructive" : "outline";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(notification.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(notification.id);
        }
      }}
      className={
        "group flex w-full items-start gap-3 rounded border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
        (isOpened
          ? "bg-muted/40 border-border"
          : "bg-primary/15 border-primary shadow-sm hover:bg-primary/25")
      }
    >
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconBg}`}
      >
        {icon}
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span
            className={
              "text-sm font-medium" +
              (isOpened ? " text-muted-foreground" : " text-foreground")
            }
          >
            {notification.title}
          </span>
          <Badge
            variant={badgeVariant as "outline" | "destructive"}
            className="text-[10px] px-1.5 py-0"
          >
            {badgeLabel}
          </Badge>
        </div>
        <p
          className={
            "text-xs" +
            (isOpened ? " text-muted-foreground/80" : " text-muted-foreground")
          }
        >
          {notification.message}
        </p>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(notification.id);
        }}
        className="mt-0.5 shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
