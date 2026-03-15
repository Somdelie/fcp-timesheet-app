"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowRight,
  MoreHorizontal,
  Trash2,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Building2,
  Package,
  Ruler,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { deletePaintPlan, addPaintUsage } from "@/actions/paint-planning";
import { ConfirmationDialog } from "@/components/common/ConfirmationDialog";
import type { PaintPlan } from "@/types/paint-planning";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function cn(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

function getUsageTotals(plan: PaintPlan) {
  let totalLitres = 0;
  let totalContainers = 0;
  for (const u of plan.usages) {
    totalLitres += Number(u.usedLitres) || 0;
    totalContainers += Number(u.usedContainers) || 0;
  }
  return { totalLitres, totalContainers };
}

function getProgressPercent(plan: PaintPlan) {
  const { totalContainers } = getUsageTotals(plan);
  if (plan.roundedContainers <= 0) return 0;
  return Math.min(100, (totalContainers / plan.roundedContainers) * 100);
}

function getAlertStatus(plan: PaintPlan) {
  const pct = getProgressPercent(plan);
  if (pct >= 90) return "critical";
  if (pct >= 50) return "warning";
  return "ok";
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

// ─── Row Actions ──────────────────────────────────────

function PlanRowActions({
  plan,
  onRecordUsage,
  onRefresh,
}: {
  plan: PaintPlan;
  onRecordUsage: (planId: string) => void;
  onRefresh: () => void;
}) {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await deletePaintPlan(plan.id);
      if (!res.ok) {
        toast.error(res.error || "Failed to delete plan");
        return;
      }
      toast.success("Paint plan deleted");
      setShowDeleteDialog(false);
      onRefresh();
    } catch {
      toast.error("Failed to delete plan");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Row actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            className="flex items-center gap-2"
            onSelect={(e) => {
              e.preventDefault();
              router.push(`/admin/paint-planning/${plan.id}`);
            }}
          >
            <ArrowRight className="h-4 w-4" />
            View Details
          </DropdownMenuItem>
          <DropdownMenuItem
            className="flex items-center gap-2"
            onSelect={(e) => {
              e.preventDefault();
              onRecordUsage(plan.id);
            }}
          >
            <Plus className="h-4 w-4" />
            Record Usage
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="flex items-center gap-2 text-red-600 focus:text-red-600"
            onSelect={(e) => {
              e.preventDefault();
              setShowDeleteDialog(true);
            }}
          >
            <Trash2 className="h-4 w-4" />
            Delete Plan
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Paint Plan?"
        description={`This will permanently delete "${plan.description}" and all its usage records. This action cannot be undone.`}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        confirmText="Delete"
        variant="destructive"
      />
    </>
  );
}

// ─── Main Table ───────────────────────────────────────

interface PaintPlansTableProps {
  data: PaintPlan[];
  onRefresh: () => void;
}

export default function PaintPlansTable({
  data,
  onRefresh,
}: PaintPlansTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  });

  // Usage dialog
  const [usageDialogPlanId, setUsageDialogPlanId] = React.useState<
    string | null
  >(null);
  const [usageLitres, setUsageLitres] = React.useState("");
  const [usageContainers, setUsageContainers] = React.useState("");
  const [usageNote, setUsageNote] = React.useState("");
  const [usageDate, setUsageDate] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [usageError, setUsageError] = React.useState("");

  async function handleAddUsage() {
    if (!usageDialogPlanId) return;
    setUsageError("");
    const litres = parseFloat(usageLitres) || null;
    const containers = parseFloat(usageContainers) || null;
    if (!litres && !containers) {
      setUsageError("Enter litres or containers used.");
      return;
    }
    setSubmitting(true);
    const res = await addPaintUsage({
      planId: usageDialogPlanId,
      usedLitres: litres,
      usedContainers: containers,
      note: usageNote || null,
      usedOn: usageDate || null,
    });
    setSubmitting(false);
    if (!res.ok) {
      setUsageError(res.error);
      return;
    }
    toast.success("Usage recorded");
    setUsageDialogPlanId(null);
    setUsageLitres("");
    setUsageContainers("");
    setUsageNote("");
    setUsageDate("");
    onRefresh();
  }

  const columns: ColumnDef<PaintPlan>[] = React.useMemo(
    () => [
      {
        id: "description",
        accessorKey: "description",
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(isSorted === "asc")}
            >
              <Layers className="h-4 w-4 text-indigo-600" />
              Description
              {isSorted === "asc" ? (
                <ChevronUp className="h-4 w-4" />
              ) : isSorted === "desc" ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          );
        },
        cell: ({ row }) => (
          <div>
            <span className="font-semibold text-sm">
              {row.original.description}
            </span>
            {row.original.boqReference && (
              <div className="text-xs text-muted-foreground">
                BOQ: {row.original.boqReference}
              </div>
            )}
          </div>
        ),
      },
      {
        id: "site",
        accessorFn: (row) => row.site.name,
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(isSorted === "asc")}
            >
              <Building2 className="h-4 w-4 text-sky-600" />
              Site
              {isSorted === "asc" ? (
                <ChevronUp className="h-4 w-4" />
              ) : isSorted === "desc" ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          );
        },
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.site.name}
            {row.original.site.code && (
              <span className="text-xs text-muted-foreground ml-1">
                ({row.original.site.code})
              </span>
            )}
          </span>
        ),
      },
      {
        id: "product",
        accessorFn: (row) => row.product.name,
        header: () => (
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-amber-600" />
            Product
          </div>
        ),
        cell: ({ row }) => (
          <span className="text-sm">{row.original.product.name}</span>
        ),
      },
      {
        id: "areaM2",
        accessorKey: "areaM2",
        size: 100,
        header: () => (
          <div className="flex items-center gap-2">
            <Ruler className="h-4 w-4 text-violet-600" />
            Area m²
          </div>
        ),
        cell: ({ row }) => (
          <span className="block text-right text-sm font-mono">
            {row.original.areaM2.toLocaleString()}
          </span>
        ),
      },
      {
        id: "planned",
        size: 120,
        header: () => <div className="text-right">Planned</div>,
        cell: ({ row }) => (
          <span className="block text-right text-sm font-mono">
            {row.original.roundedContainers} ×{" "}
            {row.original.product.unitSize ?? 20}L
          </span>
        ),
      },
      {
        id: "used",
        size: 90,
        header: () => <div className="text-right">Used</div>,
        cell: ({ row }) => {
          const { totalContainers } = getUsageTotals(row.original);
          return (
            <span className="block text-right text-sm font-mono">
              {totalContainers > 0 ? totalContainers.toFixed(1) : "—"}
            </span>
          );
        },
      },
      {
        id: "progress",
        size: 160,
        header: () => <div>Progress</div>,
        cell: ({ row }) => {
          const pct = getProgressPercent(row.original);
          const alert = getAlertStatus(row.original);
          return (
            <div className="flex items-center gap-2">
              <Progress
                value={pct}
                className={`h-2 flex-1 ${
                  alert === "critical"
                    ? "[&>[data-slot=progress-indicator]]:bg-red-500"
                    : alert === "warning"
                      ? "[&>[data-slot=progress-indicator]]:bg-amber-500"
                      : "[&>[data-slot=progress-indicator]]:bg-green-500"
                }`}
              />
              <span className="text-xs font-mono w-9 text-right">
                {pct.toFixed(0)}%
              </span>
            </div>
          );
        },
      },
      {
        id: "alert",
        size: 100,
        header: () => <div>Status</div>,
        cell: ({ row }) => {
          const alert = getAlertStatus(row.original);
          if (alert === "critical") {
            return (
              <Badge variant="destructive" className="text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Near limit
              </Badge>
            );
          }
          if (alert === "warning") {
            return (
              <Badge
                variant="outline"
                className="text-xs border-amber-500 text-amber-700 dark:text-amber-400"
              >
                <AlertTriangle className="h-3 w-3 mr-1" />
                50%+
              </Badge>
            );
          }
          return (
            <Badge
              variant="outline"
              className="text-xs text-green-700 dark:text-green-400"
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              OK
            </Badge>
          );
        },
      },
      {
        id: "createdAt",
        accessorKey: "createdAt",
        header: () => null,
        enableHiding: true,
        size: 0,
        cell: () => null,
      },
      {
        id: "actions",
        size: 80,
        header: () => <div className="text-center">Actions</div>,
        cell: ({ row }) => (
          <div className="text-center">
            <PlanRowActions
              plan={row.original}
              onRecordUsage={(id) => {
                setUsageDialogPlanId(id);
                setUsageError("");
              }}
              onRefresh={onRefresh}
            />
          </div>
        ),
      },
    ],
    [onRefresh],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, pagination, columnVisibility: { createdAt: false } },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <>
      <div className="border bg-card">
        <div className="overflow-x-auto">
          <Table className="border-collapse">
            <TableHeader className="bg-muted/60">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      style={{ width: header.column.getSize() }}
                      className="border border-zinc-200 text-xs font-semibold uppercase tracking-wide dark:border-zinc-700 px-3 py-1"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>

            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => {
                  const alert = getAlertStatus(row.original);
                  return (
                    <TableRow
                      key={row.id}
                      className={cn(
                        "hover:bg-zinc-50 dark:hover:bg-zinc-900/40",
                        alert === "critical" &&
                          "bg-red-50/50 dark:bg-red-950/10",
                        alert === "warning" &&
                          "bg-amber-50/50 dark:bg-amber-950/10",
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          style={{ width: cell.column.getSize() }}
                          className="border border-zinc-200 dark:border-zinc-700 px-3 py-1"
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No paint plans found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center justify-between border-t px-4 py-3 bg-muted/60">
          <div className="text-muted-foreground hidden text-sm lg:flex">
            Showing{" "}
            {data.length === 0
              ? 0
              : table.getState().pagination.pageIndex *
                  table.getState().pagination.pageSize +
                1}{" "}
            to{" "}
            {Math.min(
              (table.getState().pagination.pageIndex + 1) *
                table.getState().pagination.pageSize,
              data.length,
            )}{" "}
            of {data.length} plans
          </div>
          <div className="flex w-full items-center gap-4 lg:w-fit lg:gap-8">
            <div className="hidden items-center gap-2 lg:flex">
              <span className="text-sm font-medium">Rows per page</span>
              <Select
                value={String(table.getState().pagination.pageSize)}
                onValueChange={(value) => table.setPageSize(Number(value))}
              >
                <SelectTrigger className="h-8 w-20">
                  <SelectValue
                    placeholder={table.getState().pagination.pageSize}
                  />
                </SelectTrigger>
                <SelectContent side="top">
                  {[5, 10, 25, 50, 100].map((pageSize) => (
                    <SelectItem key={pageSize} value={String(pageSize)}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-fit items-center justify-center text-sm font-medium">
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount() || 1}
            </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Button
                variant="outline"
                size="icon"
                className="hidden h-8 w-8 lg:flex"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to first page</span>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to next page</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="hidden h-8 w-8 lg:flex"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to last page</span>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Record Usage Dialog */}
      <Dialog
        open={!!usageDialogPlanId}
        onOpenChange={(open) => {
          if (!open) setUsageDialogPlanId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Paint Usage</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Litres Used</Label>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={usageLitres}
                onChange={(e) => setUsageLitres(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Containers Used</Label>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={usageContainers}
                onChange={(e) => setUsageContainers(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                value={usageDate}
                onChange={(e) => setUsageDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Note</Label>
              <Input
                value={usageNote}
                onChange={(e) => setUsageNote(e.target.value)}
                placeholder="Optional note"
              />
            </div>
            {usageError && (
              <p className="text-sm text-destructive flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                {usageError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUsageDialogPlanId(null)}
            >
              Cancel
            </Button>
            <Button onClick={handleAddUsage} disabled={submitting}>
              {submitting ? "Saving..." : "Save Usage"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
