"use client";

import * as React from "react";
import { useEffect, useState, useCallback } from "react";
import { ClipboardList, FileText } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DownloadFinishingSchedulePdfButton } from "@/components/finishing-schedules/pdf/DownloadFinishingSchedulePdfButton";
import CreateFinishingScheduleDialog from "@/components/finishing-schedules/CreateFinishingScheduleDialog";
import { listFinishingSchedules } from "@/actions/site-finishing-schedule";

function fmt(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

type Schedule = {
  id: string;
  contractNo: string | null;
  client: string | null;
  contractManager: string | null;
  version: number;
  isActive: boolean;
  createdAt: Date;
  areas: { id: string; items: { id: string }[] }[];
};

export default function SiteFinishingSchedulePanel({
  siteId,
}: {
  siteId: string;
}) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listFinishingSchedules(siteId);
    if (res.ok) {
      setSchedules(res.schedules as unknown as Schedule[]);
    }
    setLoading(false);
  }, [siteId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="rounded border border-slate-200/50 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/40 backdrop-blur-sm p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-slate-500" />
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
            Finishing Schedules
          </h2>
          {!loading && (
            <Badge variant="outline" className="text-xs">
              {schedules.length}
            </Badge>
          )}
        </div>
        <CreateFinishingScheduleDialog
          siteId={siteId}
          variant="outline"
          size="sm"
          label="New Schedule"
        />
      </div>

      {loading ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          Loading…
        </p>
      ) : schedules.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center gap-2 py-8 text-center text-sm">
          <FileText className="h-8 w-8 opacity-40" />
          <p>No finishing schedules yet.</p>
          <p className="text-xs">
            Click &ldquo;New Schedule&rdquo; to create one.
          </p>
        </div>
      ) : (
        <div className="rounded border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contract No</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead className="text-center">Areas</TableHead>
                <TableHead className="text-center">Items</TableHead>
                <TableHead className="text-center">Ver.</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map((s) => {
                const totalItems = s.areas.reduce(
                  (sum, a) => sum + a.items.length,
                  0,
                );
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      {s.contractNo || "—"}
                    </TableCell>
                    <TableCell>{s.client || "—"}</TableCell>
                    <TableCell>{s.contractManager || "—"}</TableCell>
                    <TableCell className="text-center">
                      {s.areas.length}
                    </TableCell>
                    <TableCell className="text-center">{totalItems}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={s.isActive ? "default" : "outline"}>
                        v{s.version}
                      </Badge>
                    </TableCell>
                    <TableCell>{fmt(s.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <DownloadFinishingSchedulePdfButton
                        scheduleId={s.id}
                        label="PDF"
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
