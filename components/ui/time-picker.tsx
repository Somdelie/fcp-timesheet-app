"use client";

import { Clock } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface TimePickerProps {
  value: string; // "HH:mm" or ""
  onChange: (value: string) => void;
  className?: string;
}

function parse(value: string) {
  if (!value) return { hour: "", minute: "", period: "AM" };
  const [h, m] = value.split(":");
  const hour24 = parseInt(h, 10);
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  return {
    hour: String(hour12),
    minute: m,
    period,
  };
}

function to24(hour: string, minute: string, period: string): string {
  if (!hour || !minute) return "";
  let h = parseInt(hour, 10);
  if (period === "AM" && h === 12) h = 0;
  if (period === "PM" && h !== 12) h += 12;
  return `${String(h).padStart(2, "0")}:${minute}`;
}

const hours = Array.from({ length: 12 }, (_, i) => String(i + 1));
const minutes = Array.from({ length: 12 }, (_, i) =>
  String(i * 5).padStart(2, "0"),
);

export function TimePicker({ value, onChange, className }: TimePickerProps) {
  const { hour, minute, period } = parse(value);

  const update = (h: string, m: string, p: string) => {
    if (h && m) {
      onChange(to24(h, m, p));
    }
  };

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Clock className="size-4 text-muted-foreground shrink-0" />
      <Select
        value={hour}
        onValueChange={(h) => update(h, minute || "00", period)}
      >
        <SelectTrigger className="w-[62px] bg-input border-border text-center px-2">
          <SelectValue placeholder="HH" />
        </SelectTrigger>
        <SelectContent className="max-h-56">
          {hours.map((h) => (
            <SelectItem key={h} value={h}>
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="text-muted-foreground font-medium">:</span>

      <Select
        value={minute}
        onValueChange={(m) => update(hour || "12", m, period)}
      >
        <SelectTrigger className="w-[62px] bg-input border-border text-center px-2">
          <SelectValue placeholder="MM" />
        </SelectTrigger>
        <SelectContent className="max-h-56">
          {minutes.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={period}
        onValueChange={(p) => update(hour || "12", minute || "00", p)}
      >
        <SelectTrigger className="w-[62px] bg-input border-border text-center px-2">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="AM">AM</SelectItem>
          <SelectItem value="PM">PM</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
