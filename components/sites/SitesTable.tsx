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
  type OnChangeFn,
  type SortingState,
  type RowSelectionState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  ArrowRight,
  Camera,
  MoreHorizontal,
  CheckCircle,
  Trash2,
  Pencil,
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
  Package,
  Briefcase,
  Hammer,
  Calculator,
  Loader2,
  CalendarDays,
  Plus,
  TrendingUp,
  TrendingDown,
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
import {
  listSiteMaterials,
  type SiteMaterialRow,
} from "@/actions/site-materials";
import { Badge } from "@/components/ui/badge";
import { AddMaterialsDialog } from "./SiteMaterialsPanel";
import EditSiteLocationDialog from "./EditSiteLocationDialog";

export type SiteRow = {
  id: string;
  name: string;
  code: string | null;
  client: string | null;
  location: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  siteClaimDate: string | null;
  amountClaimed: number;
  isActive: boolean;
  specStatus:
    | "NOT_REQUESTED"
    | "NOT_NEEDED"
    | "NOT_REQUIRED"
    | "REQUESTED"
    | "RECEIVED"
    | "ACTIONED";
  specAvailable: boolean;
  hasFinishingSchedule: boolean;
  createdAt: string;
  supervisorName: string | null;
  totalWages: number;
  daysWorked: number;
  totalMaterialCost: number;
  jobStatus: "NOT_STARTED" | "ONGOING" | "COMPLETED" | "ON_HOLD";
  claimDate: string | null;
  claimAmountClaimed: number;
  claimAmountReceived: number;
  claimOutstanding: number;
  claimStatus:
    | "DRAFT"
    | "SUBMITTED"
    | "PARTIALLY_RECEIVED"
    | "RECEIVED"
    | "CANCELLED"
    | null;
};

export const SITE_TABLE_COLUMN_OPTIONS = [
  { id: "select", label: "Select" },
  { id: "code", label: "Job Number" },
  { id: "name", label: "Name" },
  { id: "supervisorName", label: "Supervisor" },
  { id: "client", label: "Client" },
  { id: "siteClaimDate", label: "Claim Date" },
  { id: "totalWages", label: "Total Wages" },
  { id: "totalMaterialCost", label: "Total Material Cost" },
  { id: "totalCost", label: "Total Cost" },
  { id: "amountClaimed", label: "Amount Claimed" },
  { id: "claimPaidToDate", label: "Paid to Date" },
  { id: "claimOutstanding", label: "Outstanding" },
  { id: "profitLoss", label: "Profit / Loss" },
  { id: "hasFinishingSchedule", label: "Finishing Schedule" },
  { id: "specStatus", label: "Spec" },
  { id: "daysWorked", label: "Days Worked" },
  { id: "actions", label: "Actions" },
] as const;

function classNames(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

const JOB_STATUS_CONFIG = {
  NOT_STARTED: {
    label: "Not Started",
    className:
      "bg-zinc-100 text-zinc-600 dark:bg-zinc-700/60 dark:text-zinc-400",
  },
  ONGOING: {
    label: "Ongoing",
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  },
  COMPLETED: {
    label: "Completed",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  },
  ON_HOLD: {
    label: "On Hold",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  },
} as const;

function JobStatusBadge({ status }: { status: string }) {
  const cfg = JOB_STATUS_CONFIG[status as keyof typeof JOB_STATUS_CONFIG] ?? {
    label: status,
    className: "",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
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

function YesNoPill({ value }: { value: boolean }) {
  return (
    <span
      className={classNames(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        value
          ? "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
          : "bg-zinc-200/60 text-zinc-600 dark:bg-zinc-700/50 dark:text-zinc-300",
      )}
    >
      {value ? "Yes" : "No"}
    </span>
  );
}

const SPEC_STATUS_CONFIG = {
  NOT_REQUESTED: {
    label: "Not requested",
    className:
      "bg-zinc-200/60 text-zinc-600 dark:bg-zinc-700/50 dark:text-zinc-300",
  },
  NOT_NEEDED: {
    label: "Not Required",
    className:
      "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300",
  },
  NOT_REQUIRED: {
    label: "Not Required",
    className:
      "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300",
  },
  REQUESTED: {
    label: "Requested",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  RECEIVED: {
    label: "Received",
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  ACTIONED: {
    label: "Actioned",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
} as const;

function SpecStatusPill({ status }: { status: SiteRow["specStatus"] }) {
  const cfg = SPEC_STATUS_CONFIG[status] ?? SPEC_STATUS_CONFIG.NOT_REQUESTED;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.className}`}
    >
      {cfg.label}
    </span>
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

function getSiteMaterialQuantity(siteMaterial: SiteMaterialRow): number | null {
  const usageTotal = (siteMaterial.usages ?? []).reduce(
    (sum, usage) => sum + (usage.quantity ?? 0),
    0,
  );
  if (siteMaterial.quantity != null) return siteMaterial.quantity;
  if (usageTotal > 0) return usageTotal;
  if ((siteMaterial as any).orderedQuantity > 0)
    return (siteMaterial as any).orderedQuantity;
  return null;
}

function SiteRowActions({
  site,
  role,
  onRequestPhoto,
  supervisorOptions = [],
  foremanOptions = [],
}: {
  site: SiteRow;
  role: string;
  onRequestPhoto: () => void;
  supervisorOptions?: Array<{ id: string; name: string; email: string }>;
  foremanOptions?: Array<{ id: string; name: string; email: string }>;
}) {
  const router = useRouter();
  const [showEditDialog, setShowEditDialog] = React.useState(false);
  const [showFinishDialog, setShowFinishDialog] = React.useState(false);
  const [isFinishing, setIsFinishing] = React.useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Site Products dialog state
  const [showProductsDialog, setShowProductsDialog] = React.useState(false);
  const [siteProducts, setSiteProducts] = React.useState<SiteMaterialRow[]>([]);
  const [loadingProducts, setLoadingProducts] = React.useState(false);

  // Add Materials dialog state
  const [addMaterialsOpen, setAddMaterialsOpen] = React.useState(false);

  const loadSiteProducts = React.useCallback(async () => {
    setLoadingProducts(true);
    try {
      const res = await listSiteMaterials(site.id);
      console.debug("listSiteMaterials response for site", site.id, res);
      if (res.ok) {
        const sortedMaterials = res.materials.slice().sort((a, b) => {
          const aQty = getSiteMaterialQuantity(a) ?? -1;
          const bQty = getSiteMaterialQuantity(b) ?? -1;
          if (bQty !== aQty) return bQty - aQty;
          return a.product.name.localeCompare(b.product.name);
        });
        setSiteProducts(sortedMaterials);
      }
    } finally {
      setLoadingProducts(false);
    }
  }, [site.id]);

  React.useEffect(() => {
    if (!showProductsDialog) return;
    loadSiteProducts();
  }, [showProductsDialog, loadSiteProducts]);

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
              setShowEditDialog(true);
            }}
          >
            <Pencil className="h-4 w-4" />
            Quick Edit
          </DropdownMenuItem>

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

          <DropdownMenuItem
            className="flex items-center gap-2"
            onSelect={(e) => {
              e.preventDefault();
              setShowProductsDialog(true);
            }}
          >
            <Package className="h-4 w-4" />
            Site Products
          </DropdownMenuItem>

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

      <EditSiteLocationDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        hideTrigger
        siteId={site.id}
        initialName={site.name}
        initialCode={site.code}
        initialClient={site.client}
        initialLocation={site.location}
        initialAddress={site.address ?? site.location}
        initialLatitude={site.latitude}
        initialLongitude={site.longitude}
        initialSiteClaimDate={site.siteClaimDate}
        initialAmountClaimed={site.amountClaimed}
        initialJobStatus={site.jobStatus}
        initialSpecStatus={site.specStatus}
        initialSpecAvailable={site.specAvailable}
        canEditCoreDetails={role === "ADMIN"}
        supervisorOptions={supervisorOptions}
        foremanOptions={foremanOptions}
      />

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

      {/* Site Products Dialog */}
      <Dialog open={showProductsDialog} onOpenChange={setShowProductsDialog}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-6xl max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>Site Products — {site.name}</DialogTitle>
            <DialogDescription>
              Materials expected to be used on this job site.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-auto rounded-md border border-slate-200 dark:border-slate-700">
            {loadingProducts ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              </div>
            ) : siteProducts.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                No materials assigned to this site yet.
              </p>
            ) : (
              <Table className="min-w-[720px] table-fixed border-collapse [&_th]:border [&_th]:border-slate-200 [&_th]:dark:border-slate-700 [&_td]:border [&_td]:border-slate-200 [&_td]:dark:border-slate-700">
                <colgroup>
                  <col className="w-[18%]" />
                  <col className="w-[42%]" />
                  <col className="w-[30%]" />
                  <col className="w-[10%]" />
                </colgroup>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {siteProducts.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono text-xs">
                        {m.product.sku || "—"}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex min-w-0 items-center gap-2">
                          <Package className="h-4 w-4 shrink-0 text-slate-400" />
                          <span className="truncate" title={m.product.name}>
                            {m.product.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {m.product.category ? (
                          <Badge variant="secondary">
                            {m.product.category.name}
                          </Badge>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {getSiteMaterialQuantity(m) != null
                          ? getSiteMaterialQuantity(m)
                          : "—"}
                      </TableCell>
                      {/* <TableCell className="text-xs text-slate-600">
                        {`${getSiteMaterialQuantity(m) ?? "—"} / ${
                          (m as any).orderedQuantity ?? 0
                        }`}
                      </TableCell> */}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <DialogFooter className="shrink-0 sm:justify-between">
            <Button
              variant="outline"
              onClick={() => setShowProductsDialog(false)}
            >
              Close
            </Button>

            <Button onClick={() => setAddMaterialsOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Materials
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Materials Dialog */}
      <AddMaterialsDialog
        siteId={site.id}
        open={addMaterialsOpen}
        onOpenChange={setAddMaterialsOpen}
        existingProductIds={siteProducts.map((m) => m.productId)}
        onAdded={async () => {
          await loadSiteProducts();
          router.refresh();
        }}
      />
    </>
  );
}

interface SitesTableProps {
  data: SiteRow[];
  role: string;
  onRequestPhoto: (site: SiteRow) => void;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>;
  supervisorOptions?: Array<{ id: string; name: string; email: string }>;
  foremanOptions?: Array<{ id: string; name: string; email: string }>;
}

export default function SitesTable({
  data,
  role,
  onRequestPhoto,
  rowSelection: controlledRowSelection,
  onRowSelectionChange,
  columnVisibility,
  onColumnVisibilityChange,
  supervisorOptions = [],
  foremanOptions = [],
}: SitesTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "code", desc: true },
  ]);
  const [internalRowSelection, setInternalRowSelection] =
    React.useState<RowSelectionState>({});
  const rowSelection = controlledRowSelection ?? internalRowSelection;
  const handleRowSelectionChange =
    onRowSelectionChange ?? setInternalRowSelection;
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  });

  const columns: ColumnDef<SiteRow>[] = React.useMemo(
    () => [
      {
        id: "select",
        size: 48,
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
        sortingFn: (rowA, rowB, columnId) => {
          const aValue = rowA.getValue<string>(columnId) ?? "";
          const bValue = rowB.getValue<string>(columnId) ?? "";
          const aNumber = Number(aValue);
          const bNumber = Number(bValue);

          const aIsNumber = !Number.isNaN(aNumber);
          const bIsNumber = !Number.isNaN(bNumber);

          if (aIsNumber && bIsNumber) {
            return aNumber - bNumber;
          }
          return String(aValue).localeCompare(String(bValue));
        },
        size: 80,
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(isSorted === "asc")}
            >
              {/* <Hash className="h-4 w-4 text-indigo-600" /> */}
              Job#
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
        size: 220,
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
          <span
            className="block font-semibold uppercase truncate max-w-50"
            title={row.original.name}
          >
            {row.original.name}
          </span>
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
          <span className="text-sm uppercase">
            {row.original.client ?? "—"}
          </span>
        ),
      },
      {
        id: "siteClaimDate",
        accessorKey: "siteClaimDate",
        size: 130,
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(isSorted === "asc")}
            >
              <CalendarDays className="h-4 w-4 text-slate-600" />
              Claim Date
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
          <span className="text-xs">
            {row.original.siteClaimDate
              ? formatDate(row.original.siteClaimDate)
              : "—"}
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
        cell: ({ row }) => {
          const amount = row.original.totalWages ?? 0;
          const claimed = row.original.amountClaimed ?? 0;
          const pct = claimed > 0 ? (amount / claimed) * 100 : null;
          return (
            <div className="text-right">
              <span className="block text-sm font-bold text-slate-700 dark:text-slate-200">
                {formatCurrency(amount)}
              </span>
              {pct !== null && (
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  {pct.toFixed(1)}%
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "totalMaterialCost",
        accessorKey: "totalMaterialCost",
        size: 150,
        header: () => (
          <div className="flex items-center gap-2">
            <Hammer className="h-4 w-4 text-orange-600" />
            Material Cost
          </div>
        ),
        cell: ({ row }) => {
          const amount = row.original.totalMaterialCost ?? 0;
          const claimed = row.original.amountClaimed ?? 0;
          const pct = claimed > 0 ? (amount / claimed) * 100 : null;
          return (
            <div className="text-right">
              <span className="block text-sm font-bold text-slate-700 dark:text-slate-200">
                {formatCurrency(amount)}
              </span>
              {pct !== null && (
                <span className="text-[11px] font-semibold text-orange-700 dark:text-orange-400">
                  {pct.toFixed(1)}%
                </span>
              )}
            </div>
          );
        },
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
          <span className="block text-right text-sm font-bold text-slate-700 dark:text-slate-200">
            {formatCurrency(
              (row.original.totalWages ?? 0) +
                (row.original.totalMaterialCost ?? 0),
            )}
          </span>
        ),
      },
      {
        id: "amountClaimed",
        accessorKey: "amountClaimed",
        size: 150,
        header: () => (
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-teal-600" />
            Amount Claimed
          </div>
        ),
        cell: ({ row }) => (
          <span className="block text-right text-sm font-bold text-slate-700 dark:text-slate-200">
            {formatCurrency(row.original.amountClaimed ?? 0)}
          </span>
        ),
      },
      {
        id: "claimPaidToDate",
        accessorKey: "claimAmountReceived",
        size: 150,
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(isSorted === "asc")}
            >
              <Wallet className="h-4 w-4 text-emerald-600" />
              Paid to Date
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
        cell: ({ row }) => {
          const v = row.original.claimAmountReceived;
          return v > 0 ? (
            <span className="block text-right text-sm font-bold text-slate-700 dark:text-slate-200">
              {formatCurrency(v)}
            </span>
          ) : (
            <span className="block text-right text-xs text-muted-foreground">
              —
            </span>
          );
        },
      },
      {
        id: "claimOutstanding",
        accessorKey: "claimOutstanding",
        size: 160,
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(isSorted === "asc")}
            >
              <Calculator className="h-4 w-4 text-amber-600" />
              Outstanding
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
        cell: ({ row }) => {
          const v = row.original.claimOutstanding;
          if (v <= 0 && row.original.claimAmountClaimed === 0)
            return (
              <span className="block text-right text-xs text-muted-foreground">
                —
              </span>
            );
          return (
            <span className="block text-right text-sm font-bold text-amber-700 dark:text-amber-400">
              {formatCurrency(v)}
            </span>
          );
        },
      },
      {
        id: "profitLoss",
        size: 150,
        header: () => (
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-violet-600" />
            Profit / Loss
          </div>
        ),
        cell: ({ row }) => {
          const claimed = row.original.amountClaimed ?? 0;
          const totalCost =
            (row.original.totalWages ?? 0) +
            (row.original.totalMaterialCost ?? 0);
          if (claimed === 0) {
            return (
              <span className="block text-right text-xs text-muted-foreground">
                —
              </span>
            );
          }
          const pl = claimed - totalCost;
          const isProfit = pl >= 0;
          const pct = (pl / claimed) * 100;
          return (
            <div className="text-right">
              <div className="flex items-center justify-end gap-1">
                {isProfit ? (
                  <TrendingUp className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 shrink-0 text-red-500" />
                )}
                <span
                  className={`text-sm font-bold ${isProfit ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
                >
                  {isProfit ? "+" : ""}
                  {formatCurrency(pl)}
                </span>
              </div>
              <span
                className={`text-[11px] font-semibold ${isProfit ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
              >
                {isProfit ? "+" : ""}
                {pct.toFixed(1)}%
              </span>
            </div>
          );
        },
      },
      {
        id: "hasFinishingSchedule",
        accessorKey: "hasFinishingSchedule",
        size: 145,
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(isSorted === "asc")}
            >
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              Finishing Sch
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
          <YesNoPill value={row.original.hasFinishingSchedule} />
        ),
      },
      {
        id: "specStatus",
        accessorKey: "specStatus",
        size: 125,
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(isSorted === "asc")}
            >
              <CheckCircle className="h-4 w-4 text-blue-600" />
              Spec
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
        cell: ({ row }) => <SpecStatusPill status={row.original.specStatus} />,
      },
      {
        id: "daysWorked",
        accessorKey: "daysWorked",
        size: 120,
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(isSorted === "asc")}
            >
              <CalendarDays className="h-4 w-4 text-cyan-600" />
              Days Worked
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
          <span className="block text-right text-sm font-bold text-slate-700 dark:text-slate-200">
            {row.original.daysWorked ?? 0}
          </span>
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
              supervisorOptions={supervisorOptions}
              foremanOptions={foremanOptions}
            />
          </div>
        ),
      },
    ],
    [role, onRequestPhoto, supervisorOptions, foremanOptions],
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      pagination,
      rowSelection,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onRowSelectionChange: handleRowSelectionChange,
    onColumnVisibilityChange,
    enableRowSelection: true,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="border bg-card">
      <div className="overflow-x-auto">
        <Table className="border-separate border-spacing-0">
          <TableHeader className="bg-muted/60">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{
                      width: header.column.getSize(),
                      minWidth: header.column.id === "select" ? 48 : undefined,
                      maxWidth: header.column.id === "select" ? 48 : undefined,
                      position: ["select", "code", "name"].includes(
                        header.column.id,
                      )
                        ? "sticky"
                        : undefined,
                      left:
                        header.column.id === "select"
                          ? 0
                          : header.column.id === "code"
                            ? 48
                            : header.column.id === "name"
                              ? 128
                              : undefined,
                    }}
                    className={classNames(
                      "border border-zinc-200 text-xs font-semibold uppercase tracking-wide dark:border-zinc-700",
                      header.column.id === "select"
                        ? "px-3 py-2 text-center"
                        : "px-3 py-1",
                      ["select", "code", "name"].includes(header.column.id) &&
                        "z-20 bg-muted",
                      header.column.id === "totalWages" &&
                        "bg-emerald-200 dark:bg-emerald-900/60",
                      header.column.id === "totalMaterialCost" &&
                        "bg-orange-200 dark:bg-orange-900/60",
                      header.column.id === "amountClaimed" &&
                        "bg-teal-200 dark:bg-teal-900/60",
                      header.column.id === "profitLoss" &&
                        "bg-violet-200 dark:bg-violet-900/60",
                    )}
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
                        width: cell.column.getSize(),
                        minWidth: cell.column.id === "select" ? 48 : undefined,
                        maxWidth: cell.column.id === "select" ? 48 : undefined,
                        position: ["select", "code", "name"].includes(
                          cell.column.id,
                        )
                          ? "sticky"
                          : undefined,
                        left:
                          cell.column.id === "select"
                            ? 0
                            : cell.column.id === "code"
                              ? 48
                              : cell.column.id === "name"
                                ? 128
                                : undefined,
                      }}
                      className={classNames(
                        "border border-zinc-200 dark:border-zinc-700",
                        cell.column.id === "select"
                          ? "px-3 py-2 text-center"
                          : "px-3 py-1",
                        ["select", "code", "name"].includes(cell.column.id) &&
                          "z-10 bg-card",
                        cell.column.id === "totalWages" &&
                          "bg-emerald-100 dark:bg-emerald-900/40",
                        cell.column.id === "totalMaterialCost" &&
                          "bg-orange-100 dark:bg-orange-900/40",
                        cell.column.id === "amountClaimed" &&
                          "bg-teal-100 dark:bg-teal-900/40",
                        cell.column.id === "profitLoss" &&
                          "bg-violet-100 dark:bg-violet-900/40",
                      )}
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
