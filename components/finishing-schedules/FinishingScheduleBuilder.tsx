"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  Plus,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { DownloadFinishingSchedulePdfButton } from "@/components/finishing-schedules/pdf/DownloadFinishingSchedulePdfButton";
import EditScheduleHeaderDialog from "@/components/finishing-schedules/EditScheduleHeaderDialog";
import CreateAreaDialog from "@/components/finishing-schedules/CreateAreaDialog";
import EditAreaDialog from "@/components/finishing-schedules/EditAreaDialog";
import DeleteAreaButton from "@/components/finishing-schedules/DeleteAreaButton";
import CreateItemDialog from "@/components/finishing-schedules/CreateItemDialog";
import EditItemDialog from "@/components/finishing-schedules/EditItemDialog";
import DeleteItemButton from "@/components/finishing-schedules/DeleteItemButton";
import { reorderFinishingItems } from "@/actions/site-finishing-schedule";

// ============================================================================
// Types
// ============================================================================

type SiteMaterialOption = {
  id: string;
  product: {
    id: string;
    name: string;
    sku: string | null;
    supplier: { id: string; name: string } | null;
  };
};

type ScheduleItem = {
  id: string;
  zone: "INTERNAL" | "EXTERNAL";
  position: string;
  product: string | null;
  colorCode: string | null;
  supplier: string | null;
  note: string | null;
  sortOrder: number;
  siteMaterialId: string | null;
};

type ScheduleArea = {
  id: string;
  name: string;
  label: string | null;
  sortOrder: number;
  items: ScheduleItem[];
};

type Schedule = {
  id: string;
  siteId: string;
  contractNo: string | null;
  contractManager: string | null;
  siteForeman: string | null;
  client: string | null;
  startDate: Date | string | null;
  completionDate: Date | string | null;
  drawingDetails: string | null;
  contactInfo: string | null;
  version: number;
  isActive: boolean;
  site: { id: string; name: string; code: string | null };
  areas: ScheduleArea[];
};

interface Props {
  schedule: Schedule;
  siteMaterials: SiteMaterialOption[];
}

// ============================================================================
// Helpers
// ============================================================================

function fmt(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

// ============================================================================
// Component
// ============================================================================

export default function FinishingScheduleBuilder({
  schedule,
  siteMaterials,
}: Props) {
  const router = useRouter();

  async function handleMoveItem(
    areaId: string,
    items: ScheduleItem[],
    index: number,
    direction: "up" | "down",
  ) {
    const newItems = [...items];
    const swapIdx = direction === "up" ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= newItems.length) return;
    [newItems[index], newItems[swapIdx]] = [newItems[swapIdx], newItems[index]];
    await reorderFinishingItems({
      areaId,
      itemIds: newItems.map((i) => i.id),
    });
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      {/* Top bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/finishing-schedules">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Finishing Schedule
            </h1>
            <p className="text-muted-foreground text-sm">
              {schedule.site.name}
              {schedule.site.code && (
                <Badge variant="outline" className="ml-2 text-xs">
                  {schedule.site.code}
                </Badge>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CreateAreaDialog scheduleId={schedule.id} />
          <DownloadFinishingSchedulePdfButton scheduleId={schedule.id} />
        </div>
      </div>

      {/* Header card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Schedule Details</CardTitle>
          <EditScheduleHeaderDialog schedule={schedule} />
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Contract No</dt>
              <dd className="font-medium">{schedule.contractNo || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Client</dt>
              <dd className="font-medium">{schedule.client || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Contract Manager</dt>
              <dd className="font-medium">{schedule.contractManager || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Site Foreman</dt>
              <dd className="font-medium">{schedule.siteForeman || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Start Date</dt>
              <dd className="font-medium">{fmt(schedule.startDate)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Completion</dt>
              <dd className="font-medium">{fmt(schedule.completionDate)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Drawing Details</dt>
              <dd className="font-medium">{schedule.drawingDetails || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Contact Info</dt>
              <dd className="font-medium">{schedule.contactInfo || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">FCP QS</dt>
              <dd className="font-medium">Janice Raath</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Areas */}
      {schedule.areas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12">
            <p className="text-muted-foreground text-sm">
              No areas added yet. Click &ldquo;Add Area&rdquo; to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        schedule.areas.map((area) => {
          const internalItems = area.items.filter((i) => i.zone === "INTERNAL");
          const externalItems = area.items.filter((i) => i.zone === "EXTERNAL");

          return (
            <Card key={area.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">
                    Area&ensp;
                    <span className="font-bold">{area.name}</span>
                    {area.label && (
                      <span className="text-muted-foreground ml-2 text-sm font-normal">
                        {area.label}
                      </span>
                    )}
                  </CardTitle>
                </div>
                <div className="flex items-center gap-1">
                  <CreateItemDialog
                    areaId={area.id}
                    siteMaterials={siteMaterials}
                  />
                  <EditAreaDialog area={area} />
                  <DeleteAreaButton areaId={area.id} areaName={area.name} />
                </div>
              </CardHeader>
              <CardContent>
                {area.items.length === 0 ? (
                  <p className="text-muted-foreground py-6 text-center text-sm">
                    No items added yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto border bg-card">
                    <Table className="border-collapse">
                      <TableHeader className="bg-zinc-800 dark:bg-zinc-900">
                        <TableRow className="hover:bg-transparent border-0">
                          <TableHead className="w-40 border border-zinc-700 px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-white">
                            Position
                          </TableHead>
                          <TableHead className="border border-zinc-700 px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-white">
                            Product
                          </TableHead>
                          <TableHead className="border border-zinc-700 px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-white">
                            Color&amp;Code
                          </TableHead>
                          <TableHead className="border border-zinc-700 px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-white">
                            Supplier
                          </TableHead>
                          <TableHead className="w-25 border border-zinc-700 px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-white">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {/* Internal zone */}
                        {internalItems.length > 0 && (
                          <>
                            <TableRow className="bg-sky-600/15 hover:bg-sky-600/15 dark:bg-sky-500/20">
                              <TableCell
                                colSpan={5}
                                className="border border-zinc-200 py-2 px-3 text-sm font-bold uppercase tracking-wider text-sky-800 dark:border-zinc-700 dark:text-sky-300"
                              >
                                Internal
                              </TableCell>
                            </TableRow>
                            {internalItems.map((item, idx) => (
                              <ItemRow
                                key={item.id}
                                item={item}
                                idx={idx}
                                total={internalItems.length}
                                areaId={area.id}
                                allZoneItems={internalItems}
                                siteMaterials={siteMaterials}
                                onMove={handleMoveItem}
                              />
                            ))}
                          </>
                        )}
                        {/* External zone */}
                        {externalItems.length > 0 && (
                          <>
                            <TableRow className="bg-amber-600/15 hover:bg-amber-600/15 dark:bg-amber-500/20">
                              <TableCell
                                colSpan={5}
                                className="border border-zinc-200 py-2 px-3 text-sm font-bold uppercase tracking-wider text-amber-800 dark:border-zinc-700 dark:text-amber-300"
                              >
                                External
                              </TableCell>
                            </TableRow>
                            {externalItems.map((item, idx) => (
                              <ItemRow
                                key={item.id}
                                item={item}
                                idx={idx}
                                total={externalItems.length}
                                areaId={area.id}
                                allZoneItems={externalItems}
                                siteMaterials={siteMaterials}
                                onMove={handleMoveItem}
                              />
                            ))}
                          </>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

// ============================================================================
// Item Row
// ============================================================================

function ItemRow({
  item,
  idx,
  total,
  areaId,
  allZoneItems,
  siteMaterials,
  onMove,
}: {
  item: ScheduleItem;
  idx: number;
  total: number;
  areaId: string;
  allZoneItems: ScheduleItem[];
  siteMaterials: SiteMaterialOption[];
  onMove: (
    areaId: string,
    items: ScheduleItem[],
    index: number,
    dir: "up" | "down",
  ) => Promise<void>;
}) {
  return (
    <TableRow className="even:bg-muted/30 hover:bg-zinc-100 dark:hover:bg-zinc-900/40">
      <TableCell className="border border-zinc-200 px-3 py-2 font-medium dark:border-zinc-700">
        {item.position || "—"}
      </TableCell>
      <TableCell className="border border-zinc-200 px-3 py-2 dark:border-zinc-700">
        {item.product || "—"}
      </TableCell>
      <TableCell className="border border-zinc-200 px-3 py-2 dark:border-zinc-700">
        {item.colorCode || "—"}
      </TableCell>
      <TableCell className="border border-zinc-200 px-3 py-2 dark:border-zinc-700">
        {item.supplier || "—"}
      </TableCell>
      <TableCell className="border border-zinc-200 px-3 py-2 text-right dark:border-zinc-700">
        <div className="flex items-center justify-end gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={idx === 0}
            onClick={() => onMove(areaId, allZoneItems, idx, "up")}
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={idx === total - 1}
            onClick={() => onMove(areaId, allZoneItems, idx, "down")}
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
          <EditItemDialog item={item} siteMaterials={siteMaterials} />
          <DeleteItemButton itemId={item.id} />
        </div>
      </TableCell>
    </TableRow>
  );
}
