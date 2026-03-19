"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { Button } from "../ui/button";
import { Calendar } from "../ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { cn } from "@/lib/utils";

export function NavbarCalendar() {
  const [date, setDate] = React.useState<Date | undefined>(new Date());
  const [month, setMonth] = React.useState<Date>(new Date());
  const [timeZone, setTimeZone] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded border border-transparent transition-colors hover:border-sky-200/60 hover:bg-sky-50 hover:text-sky-700 dark:hover:border-sky-900/60 dark:hover:bg-sky-950/40 dark:hover:text-sky-300"
          aria-label="Open calendar"
        >
          <CalendarIcon className="h-5 w-5" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-105 rounded border-border/60 p-0 shadow-xl"
      >
        <div className="overflow-hidden rounded bg-background">
          {/* Header */}
          <div className="border-b border-border/60 bg-linear-to-r from-sky-500/10 via-blue-500/10 to-violet-500/10 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Calendar
                </p>
                <h3 className="mt-1 truncate text-sm font-semibold text-foreground">
                  {date ? format(date, "EEEE, d MMMM yyyy") : "Pick a date"}
                </h3>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 rounded px-2.5 text-xs"
                onClick={() => {
                  const today = new Date();
                  setDate(today);
                  setMonth(today);
                }}
              >
                Today
              </Button>
            </div>
          </div>

          {/* Month Nav */}
          <div className="flex items-center justify-between px-3 py-2.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
              }
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="text-sm font-semibold text-foreground">
              {format(month, "MMMM yyyy")}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
              }
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Calendar */}
          <div className="px-3 pb-3">
            <Calendar
              mode="single"
              month={month}
              onMonthChange={setMonth}
              selected={date}
              onSelect={setDate}
              timeZone={timeZone}
              className="w-full p-1"
              classNames={{
                months: "flex flex-col",
                month: "space-y-2",
                caption: "hidden",
                table: "w-full border-collapse",
                head_row: "grid grid-cols-7",
                head_cell:
                  "h-8 rounded text-[11px] font-medium text-muted-foreground flex items-center justify-center",
                row: "mt-1 grid grid-cols-7",
                cell: "h-9 w-full p-0 text-center text-sm",
                day: cn(
                  "h-9 w-9 rounded text-sm font-medium transition-colors",
                  "hover:bg-sky-50 hover:text-sky-700",
                  "dark:hover:bg-sky-950/40 dark:hover:text-sky-300",
                ),
                day_today:
                  "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
                day_selected:
                  "bg-sky-600 text-white hover:bg-sky-600 hover:text-white focus:bg-sky-600 focus:text-white dark:bg-sky-500",
                day_outside: "text-muted-foreground/35 opacity-60",
                day_disabled: "text-muted-foreground/30 opacity-40",
              }}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
