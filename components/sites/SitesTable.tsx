"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { formatCurrency } from "@/lib/formatCurrency";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
} from "@tanstack/react-table";
import {
  ArrowRight,
  Camera,
  MoreHorizontal,
  CheckCircle,
  Trash2,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Hash,
  Building2,
  User,
  Wallet,
  CalendarDays,
  Package,
  Briefcase,
  Hammer,
  Calculator,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { ConfirmationDialog } from "@/components/common/ConfirmationDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { markSiteFinished, deleteSite } from "@/actions/sites";

export type SiteRow = {
  id: string;
  name: string;
  code: string | null;
  client: string | null;
  location: string | null;
  isActive: boolean;
  createdAt: string;
  supervisorName: string | null;
  totalWages: number;
  totalMaterialCost: number;
};

function classNames(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <div
      className={classNames(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide transition-all",
        active
          ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
          : "bg-zinc-200/50 text-zinc-600 dark:bg-zinc-700/40 dark:text-zinc-400",
      )}
    >
      <span className="mr-1.5">
        <span
          className={classNames(
            "inline-block h-1.5 w-1.5 rounded-full",
            active
              ? "bg-emerald-500 dark:bg-emerald-400"
              : "bg-zinc-400 dark:bg-zinc-500",
          )}
        />
      </span>
      {active ? "Active" : "Inactive"}
    </div>
  );
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

function SiteRowActions({
  site,
  role,
  onRequestPhoto,
}: {
  site: SiteRow;
  role: string;
  onRequestPhoto: () => void;
}) {
  const router = useRouter();
  const [showFinishDialog, setShowFinishDialog] = React.useState(false);
  const [isFinishing, setIsFinishing] = React.useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // New Material Order state
  const [showOrderDialog, setShowOrderDialog] = React.useState(false);
  const [creatingOrder, setCreatingOrder] = React.useState(false);
  const [suppliers, setSuppliers] = React.useState<
    { id: string; name: string }[]
  >([]);
  const [orderForm, setOrderForm] = React.useState({
    supplierId: "",
    reference: "",
    note: "",
  });

  // Fetch suppliers when order dialog opens
  React.useEffect(() => {
    if (!showOrderDialog) return;
    fetch("/api/app/admin/suppliers?includeInactive=false", {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.data)
          setSuppliers(json.data.map((s: any) => ({ id: s.id, name: s.name })));
      })
      .catch(() => {});
  }, [showOrderDialog]);

  const handleCreateOrder = async () => {
    setCreatingOrder(true);
    try {
      const res = await fetch(
        `/api/app/admin/sites/${site.id}/product-orders`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            supplierId: orderForm.supplierId || null,
            reference: orderForm.reference.trim() || null,
            note: orderForm.note.trim() || null,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to create order");
      toast.success("Order created — go to site to add items");
      setShowOrderDialog(false);
      setOrderForm({ supplierId: "", reference: "", note: "" });
      router.push(`/sites/${site.id}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to create order");
    } finally {
      setCreatingOrder(false);
    }
  };

  const handleMarkFinished = async () => {
    setIsFinishing(true);
    try {
      const res = await markSiteFinished(site.id);
      if (!res.ok) {
        toast.error(res.error || "Failed to mark site as finished");
        return;
      }
      toast.success("Site marked as finished");
      setShowFinishDialog(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || "Failed to mark site as finished");
    } finally {
      setIsFinishing(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await deleteSite(site.id);
      if (!res.ok) {
        toast.error(res.error || "Failed to delete site");
        return;
      }
      toast.success("Site deleted");
      setShowDeleteDialog(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete site");
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
              router.push(`/sites/${site.id}`);
            }}
          >
            <ArrowRight className="h-4 w-4" />
            Manage
          </DropdownMenuItem>
          {(role === "ADMIN" || role === "OFFICE") && (
            <DropdownMenuItem
              className="flex items-center gap-2"
              onSelect={(e) => {
                e.preventDefault();
                setOrderForm({ supplierId: "", reference: "", note: "" });
                setShowOrderDialog(true);
              }}
            >
              <Package className="h-4 w-4" />
              New Material Order
            </DropdownMenuItem>
          )}
          {role === "ADMIN" && (
            <>
              <DropdownMenuItem
                className="flex items-center gap-2"
                onSelect={(e) => {
                  e.preventDefault();
                  onRequestPhoto();
                }}
              >
                <Camera className="h-4 w-4" />
                Request Photo
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {site.isActive && (
                <DropdownMenuItem
                  className="flex items-center gap-2"
                  onSelect={(e) => {
                    e.preventDefault();
                    setShowFinishDialog(true);
                  }}
                >
                  <CheckCircle className="h-4 w-4" />
                  Mark Finished
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="flex items-center gap-2 text-red-600 focus:text-red-600"
                onSelect={(e) => {
                  e.preventDefault();
                  setShowDeleteDialog(true);
                }}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmationDialog
        open={showFinishDialog}
        onOpenChange={setShowFinishDialog}
        title="Mark Site as Finished?"
        description={`This will mark "${site.name}" as inactive. The site will still be visible in the "All" view.`}
        onConfirm={handleMarkFinished}
        isLoading={isFinishing}
        confirmText="Mark Finished"
      />

      <ConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Site?"
        description={`This will permanently delete "${site.name}" and all its related data (assignments, site days, attendance scans, etc.). This action cannot be undone.`}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        confirmText="Delete"
        variant="destructive"
      />

      {/* New Material Order Dialog */}
      <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Material Order</DialogTitle>
            <DialogDescription>
              Create a new material order for <strong>{site.name}</strong>. You
              can add items after on the site page.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Supplier</label>
              <Select
                value={orderForm.supplierId || "NONE"}
                onValueChange={(v) =>
                  setOrderForm({
                    ...orderForm,
                    supplierId: v === "NONE" ? "" : v,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">No specific supplier</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Reference / PO #</label>
              <Input
                value={orderForm.reference}
                onChange={(e) =>
                  setOrderForm({ ...orderForm, reference: e.target.value })
                }
                placeholder="e.g. PO-2026-001"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Note</label>
              <Input
                value={orderForm.note}
                onChange={(e) =>
                  setOrderForm({ ...orderForm, note: e.target.value })
                }
                placeholder="Optional note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOrderDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateOrder} disabled={creatingOrder}>
              {creatingOrder ? "Creating..." : "Create Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface SitesTableProps {
  data: SiteRow[];
  role: string;
  onRequestPhoto: (site: SiteRow) => void;
  onSelectionChange?: (selectedSites: SiteRow[]) => void;
}

export default function SitesTable({
  data,
  role,
  onRequestPhoto,
  onSelectionChange,
}: SitesTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  });

  // Notify parent of selection changes
  React.useEffect(() => {
    if (!onSelectionChange) return;
    const selectedRows = Object.keys(rowSelection)
      .filter((k) => rowSelection[k])
      .map((k) => data[Number(k)])
      .filter(Boolean);
    onSelectionChange(selectedRows);
  }, [rowSelection, data, onSelectionChange]);

  const columns: ColumnDef<SiteRow>[] = React.useMemo(
    () => [
      {
        id: "select",
        size: 40,
        header: ({ table }) => (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={
                table.getIsAllPageRowsSelected() ||
                (table.getIsSomePageRowsSelected() && "indeterminate")
              }
              onCheckedChange={(value) =>
                table.toggleAllPageRowsSelected(!!value)
              }
              aria-label="Select all"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label="Select row"
            />
          </div>
        ),
      },
      {
        id: "code",
        accessorKey: "code",
        size: 120,
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(isSorted === "asc")}
            >
              <Hash className="h-4 w-4 text-indigo-600" />
              Job Number
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
          <span className="font-mono text-xs">{row.original.code ?? "—"}</span>
        ),
      },
      {
        id: "name",
        accessorKey: "name",
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(isSorted === "asc")}
            >
              <Building2 className="h-4 w-4 text-sky-600" />
              Name
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
          <span className="font-semibold uppercase">{row.original.name}</span>
        ),
      },
      {
        id: "client",
        accessorKey: "client",
        size: 150,
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(isSorted === "asc")}
            >
              <Briefcase className="h-4 w-4 text-amber-600" />
              Client
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
          <span className="text-sm">{row.original.client ?? "—"}</span>
        ),
      },
      {
        id: "supervisorName",
        accessorKey: "supervisorName",
        size: 180,
        header: () => (
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-violet-600" />
            Supervisor
          </div>
        ),
        cell: ({ row }) => (
          <span className="text-sm capitalize">
            {row.original.supervisorName ?? "—"}
          </span>
        ),
      },
      {
        id: "totalWages",
        accessorKey: "totalWages",
        size: 130,
        header: () => (
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-emerald-600" />
            Total Wages
          </div>
        ),
        cell: ({ row }) => (
          <span className="text-sm font-medium">
            {formatCurrency(row.original.totalWages ?? 0)}
          </span>
        ),
      },
      {
        id: "totalMaterialCost",
        accessorKey: "totalMaterialCost",
        size: 150,
        header: () => (
          <div className="flex items-center gap-2">
            <Hammer className="h-4 w-4 text-orange-600" />
            Total Material Cost
          </div>
        ),
        cell: ({ row }) => (
          <span className="text-sm font-medium">
            {formatCurrency(row.original.totalMaterialCost ?? 0)}
          </span>
        ),
      },
      {
        id: "totalCost",
        size: 140,
        header: () => (
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-rose-600" />
            Total Cost
          </div>
        ),
        cell: ({ row }) => (
          <span className="text-sm font-semibold">
            {formatCurrency(
              (row.original.totalWages ?? 0) +
                (row.original.totalMaterialCost ?? 0),
            )}
          </span>
        ),
      },
      {
        id: "createdAt",
        accessorKey: "createdAt",
        size: 110,
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(isSorted === "asc")}
            >
              <CalendarDays className="h-4 w-4 text-emerald-600" />
              Created
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
          <span className="text-xs">{formatDate(row.original.createdAt)}</span>
        ),
      },
      {
        id: "actions",
        size: 80,
        header: () => <div className="text-center">Actions</div>,
        cell: ({ row }) => (
          <div className="text-center">
            <SiteRowActions
              site={row.original}
              role={role}
              onRequestPhoto={() => onRequestPhoto(row.original)}
            />
          </div>
        ),
      },
    ],
    [role, onRequestPhoto],
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      pagination,
      rowSelection,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="border bg-card">
      <div className="overflow-x-auto">
        <Table className="border-collapse">
          <TableHeader className="bg-muted/60">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{
                      width:
                        header.column.getSize() !== 150
                          ? header.column.getSize()
                          : undefined,
                    }}
                    className="border border-zinc-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide dark:border-zinc-700"
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
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      style={{
                        width:
                          cell.column.getSize() !== 150
                            ? cell.column.getSize()
                            : undefined,
                      }}
                      className="border border-zinc-200 px-3 py-1 dark:border-zinc-700"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
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
          {table.getState().pagination.pageIndex *
            table.getState().pagination.pageSize +
            1}{" "}
          to{" "}
          {Math.min(
            (table.getState().pagination.pageIndex + 1) *
              table.getState().pagination.pageSize,
            data.length,
          )}{" "}
          of {data.length} sites
        </div>
        <div className="flex w-full items-center gap-4 lg:w-fit lg:gap-8">
          <div className="hidden items-center gap-2 lg:flex">
            <span className="text-sm font-medium">Rows per page</span>
            <Select
              value={String(table.getState().pagination.pageSize)}
              onValueChange={(value) => {
                table.setPageSize(Number(value));
              }}
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
  );
}
