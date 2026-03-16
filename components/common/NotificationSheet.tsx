"use client";

import React, { useEffect, useState, useTransition } from "react";
import {
  Bell,
  CalendarClock,
  DollarSign,
  Clock,
  CloudRain,
  X,
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
  const [isPending, startTransition] = useTransition();

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
    setDismissed(new Set(notifications.map((n) => n.id)));
  };

  // Fetch on mount and when sheet opens
  useEffect(() => {
    fetchNotifications();
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
        <SheetContent side="right" className="flex flex-col p-0">
          <SheetHeader className="border-b px-4 py-4 mt-4">
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
              Alerts for upcoming claim dates, cost thresholds, scheduled tasks,
              and weather.
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1 px-4 py-2">
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
              <div className="flex flex-col gap-2 pb-4">
                {visible.map((n) => (
                  <NotificationCard
                    key={n.id}
                    notification={n}
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
  onDismiss,
}: {
  notification: NotificationItem;
  onDismiss: (id: string) => void;
}) {
  const isClaim = notification.type === "CLAIM_DUE";
  const isTask = notification.type === "TASK_DUE";
  const isWeather = notification.type === "WEATHER_ALERT";

  const iconBg = isWeather
    ? "bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400"
    : isTask
      ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
      : isClaim
        ? "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
        : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400";

  const icon = isWeather ? (
    <CloudRain className="h-4 w-4" />
  ) : isTask ? (
    <Clock className="h-4 w-4" />
  ) : isClaim ? (
    <CalendarClock className="h-4 w-4" />
  ) : (
    <DollarSign className="h-4 w-4" />
  );

  const badgeLabel = isWeather
    ? "Weather"
    : isTask
      ? "Task"
      : isClaim
        ? "Claim"
        : "Cost";
  const badgeVariant = isWeather
    ? "outline"
    : isTask
      ? "outline"
      : isClaim
        ? "outline"
        : "destructive";

  return (
    <div className="group flex items-start gap-3 rounded border p-3 transition-colors hover:bg-muted/50">
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconBg}`}
      >
        {icon}
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{notification.title}</span>
          <Badge
            variant={badgeVariant as "outline" | "destructive"}
            className="text-[10px] px-1.5 py-0"
          >
            {badgeLabel}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{notification.message}</p>
      </div>
      <button
        onClick={() => onDismiss(notification.id)}
        className="mt-0.5 shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
