"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PageSizeSelectProps = {
  value: number;
  options: readonly number[];
};

export function PageSizeSelect({ value, options }: PageSizeSelectProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function handleValueChange(nextValue: string) {
    if (nextValue === String(value)) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set("pageSize", nextValue);
    params.set("page", "1");

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <Select
      value={String(value)}
      onValueChange={handleValueChange}
      disabled={isPending}
    >
      <SelectTrigger className="h-8 w-20" aria-label="Rows per page">
        <SelectValue />
      </SelectTrigger>
      <SelectContent side="top">
        {options.map((size) => (
          <SelectItem key={size} value={String(size)}>
            {size}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
