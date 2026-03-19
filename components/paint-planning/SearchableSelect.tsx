"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Check, ChevronDown, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

type Option = {
  value: string;
  label: string;
};

type Props = {
  options: Option[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Select...",
  disabled = false,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedLabel = useMemo(
    () => options.find((o) => o.value === value)?.label ?? "",
    [options, value],
  );

  const filtered = useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, search]);

  useEffect(() => {
    if (open) {
      setSearch("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal h-9",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">
            {value ? selectedLabel : placeholder}
          </span>
          <div className="flex items-center gap-1 shrink-0 ml-1">
            {value && (
              <span
                role="button"
                className="rounded opacity-50 hover:opacity-100 p-0.5"
                onClick={(e) => {
                  e.stopPropagation();
                  onValueChange("");
                }}
              >
                <X className="h-3 w-3" />
              </span>
            )}
            <ChevronDown className="h-3.5 w-3.5 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <div className="flex items-center border-b px-2">
          <Search className="h-3.5 w-3.5 shrink-0 opacity-50" />
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="flex h-9 w-full bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-60 overflow-y-auto p-1">
          {filtered.length === 0 && (
            <div className="py-4 text-center text-sm text-muted-foreground">
              No results found
            </div>
          )}
          {filtered.map((opt) => (
            <div
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              className={cn(
                "relative flex cursor-pointer items-center rounded px-2 py-1.5 text-sm outline-none select-none hover:bg-accent hover:text-accent-foreground",
                opt.value === value && "bg-accent/50",
              )}
              onClick={() => {
                onValueChange(opt.value === value ? "" : opt.value);
                setOpen(false);
              }}
            >
              <Check
                className={cn(
                  "mr-2 h-3.5 w-3.5 shrink-0",
                  opt.value === value ? "opacity-100" : "opacity-0",
                )}
              />
              <span className="truncate">{opt.label}</span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
