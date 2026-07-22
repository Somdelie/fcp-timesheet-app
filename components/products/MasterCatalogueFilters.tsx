"use client";

import { RefreshCw, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type MasterCatalogueFiltersProps = {
  initialQuery: string;
  includeInactive: boolean;
  hasFilters: boolean;
};

export function MasterCatalogueFilters({
  initialQuery,
  includeInactive,
  hasFilters,
}: MasterCatalogueFiltersProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentQueryString = searchParams.toString();
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState(includeInactive ? "all" : "active");
  const [isPending, startTransition] = useTransition();
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(currentQueryString);

      if (query.trim()) params.set("q", query.trim());
      else params.delete("q");

      if (status === "all") params.set("includeInactive", "true");
      else params.delete("includeInactive");

      params.set("page", "1");
      const qs = params.toString();
      if (qs === currentQueryString) return;

      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, {
          scroll: false,
        });
      });
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [currentQueryString, pathname, query, router, status]);

  function clearFilters() {
    const params = new URLSearchParams();
    const pageSize = searchParams.get("pageSize");
    if (pageSize) params.set("pageSize", pageSize);

    setQuery("");
    setStatus("active");

    startTransition(() => {
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, {
        scroll: false,
      });
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-64 flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, key, supplier, finish..."
          className="h-10 rounded pl-9"
          aria-label="Search catalogue products"
        />
      </div>

      <Select value={status} onValueChange={setStatus} disabled={isPending}>
        <SelectTrigger className="h-10 w-44 rounded">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="active">Active products</SelectItem>
          <SelectItem value="all">All products</SelectItem>
        </SelectContent>
      </Select>

      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-10 w-10 rounded"
        onClick={() => startTransition(() => router.refresh())}
        disabled={isPending}
        aria-label="Refresh catalogue"
        title="Refresh"
      >
        <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
      </Button>

      {hasFilters ? (
        <Button
          type="button"
          variant="ghost"
          className="h-10 rounded"
          onClick={clearFilters}
          disabled={isPending}
        >
          <X className="mr-2 h-4 w-4" />
          Clear
        </Button>
      ) : null}
    </div>
  );
}
