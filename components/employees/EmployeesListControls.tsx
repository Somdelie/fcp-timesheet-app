"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "next/navigation";

function buildHref(params: Record<string, string | number | undefined | null>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || String(v).trim() === "") continue;
    p.set(k, String(v));
  }
  return `?${p.toString()}`;
}

export default function EmployeesListControls({
  pageSize,
  sort,
  baseParams,
}: {
  pageSize: number;
  sort: string;
  baseParams: Record<string, string | number | undefined | null>;
}) {
  const router = useRouter();

  return (
    <>
      {/* Rows per page dropdown */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Rows</span>
        <Select
          value={String(pageSize)}
          onValueChange={(value) => {
            router.push(
              buildHref({
                ...baseParams,
                page: 1,
                pageSize: Number(value),
              }),
            );
          }}
        >
          <SelectTrigger className="h-8 w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="25">25</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sort dropdown */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Sort</span>
        <Select
          value={sort}
          onValueChange={(value) => {
            router.push(
              buildHref({
                ...baseParams,
                page: 1,
                sort: value,
              }),
            );
          }}
        >
          <SelectTrigger className="h-8 w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_desc">Newest</SelectItem>
            <SelectItem value="created_asc">Oldest</SelectItem>
            <SelectItem value="name_asc">Name A→Z</SelectItem>
            <SelectItem value="name_desc">Name Z→A</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
