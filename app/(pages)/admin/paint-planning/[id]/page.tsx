"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-toastify";
import {
  getPaintPlan,
  addPaintUsage,
  deletePaintUsage,
  deletePaintPlan,
} from "@/actions/paint-planning";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ConfirmationDialog } from "@/components/common/ConfirmationDialog";
import {
  ArrowLeft,
  Building2,
  Package,
  Ruler,
  Layers,
  Calculator,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Hash,
} from "lucide-react";

type PlanDetail = {
  id: string;
  description: string;
  boqReference: string | null;
  areaM2: number;
  coats: number;
  coverageNameSnapshot: string | null;
  coverageM2PerLitreSnapshot: number;
  coverageBasisSnapshot: "PER_COAT" | "TOTAL_SYSTEM";
  containerSizeLitresSnapshot: number;
  wastagePercent: number;
  requiredLitresBeforeWastage: number;
  wastageLitres: number;
  requiredLitres: number;
  requiredContainers: number;
  roundedContainers: number;
  estimatedCost: number | null;
  note: string | null;
  createdAt: string;
  site: { id: string; name: string; code: string | null };
  product: {
    id: string;
    name: string;
    uom: string | null;
    unitSize: number | null;
  };
  coverage: {
    id: string;
    name: string;
    coverageM2PerLitre: number;
    coverageBasis: "PER_COAT" | "TOTAL_SYSTEM";
    coverageType: "THEORETICAL" | "PRACTICAL";
    recommendedCoats: number;
    uom: string | null;
    unitSize: number | null;
    note: string | null;
  } | null;
  createdByUser: { id: string; name: string | null } | null;
  usages: {
    id: string;
    usedLitres: number | null;
    usedContainers: number | null;
    note: string | null;
    usedOn: string;
    createdByUser: { id: string; name: string | null } | null;
  }[];
};

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export default function PaintPlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Usage dialog
  const [usageDialogOpen, setUsageDialogOpen] = useState(false);
  const [usageLitres, setUsageLitres] = useState("");
  const [usageContainers, setUsageContainers] = useState("");
  const [usageNote, setUsageNote] = useState("");
  const [usageDate, setUsageDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [usageError, setUsageError] = useState("");

  // Delete
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadPlan = useCallback(async () => {
    const res = await getPaintPlan(id);
    if (res.ok) {
      setPlan(res.plan);
    } else {
      setNotFound(true);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  async function handleAddUsage() {
    setUsageError("");
    const litres = parseFloat(usageLitres) || null;
    const containers = parseFloat(usageContainers) || null;
    if (!litres && !containers) {
      setUsageError("Enter litres or containers used.");
      return;
    }
    setSubmitting(true);
    const res = await addPaintUsage({
      planId: id,
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
    setUsageDialogOpen(false);
    setUsageLitres("");
    setUsageContainers("");
    setUsageNote("");
    setUsageDate("");
    loadPlan();
  }

  async function handleDeleteUsage(usageId: string) {
    await deletePaintUsage(usageId);
    toast.success("Usage entry deleted");
    loadPlan();
  }

  async function handleDeletePlan() {
    setIsDeleting(true);
    try {
      const res = await deletePaintPlan(id);
      if (!res.ok) {
        toast.error(res.error || "Failed to delete plan");
        return;
      }
      toast.success("Paint plan deleted");
      router.push("/admin/paint-planning");
    } catch {
      toast.error("Failed to delete plan");
    } finally {
      setIsDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (notFound || !plan) {
    return (
      <div className="flex items-center justify-center px-4 py-24">
        <div className="rounded border border-slate-200/50 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/40 backdrop-blur-sm p-8 text-center max-w-md">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Paint Plan Not Found
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            The paint plan you&apos;re looking for doesn&apos;t exist.
          </p>
          <Link
            href="/admin/paint-planning"
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Paint Plans
          </Link>
        </div>
      </div>
    );
  }

  // Calculate totals
  let totalLitres = 0;
  let totalContainers = 0;
  for (const u of plan.usages) {
    totalLitres += Number(u.usedLitres) || 0;
    totalContainers += Number(u.usedContainers) || 0;
  }
  const remaining = plan.roundedContainers - totalContainers;
  const pct =
    plan.roundedContainers > 0
      ? Math.min(100, (totalContainers / plan.roundedContainers) * 100)
      : 0;
  const alert = pct >= 90 ? "critical" : pct >= 50 ? "warning" : "ok";

  return (
    <div className="mx-auto w-full max-w-7xl py-3">
      {/* Back navigation */}
      <div className="mb-2">
        <Link
          href="/admin/paint-planning"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Paint Plans
        </Link>
      </div>

      {/* Header Card */}
      <div className="mb-3 rounded border border-slate-200/50 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/40 backdrop-blur-sm p-4 shadow-sm">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                {plan.description}
              </h1>
              {alert === "ok" && (
                <Badge
                  variant="outline"
                  className="text-xs text-green-700 dark:text-green-400"
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  OK
                </Badge>
              )}
              {alert === "warning" && (
                <Badge
                  variant="outline"
                  className="text-xs border-amber-500 text-amber-700 dark:text-amber-400"
                >
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  50%+ Used
                </Badge>
              )}
              {alert === "critical" && (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Near Limit
                </Badge>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Site:{" "}
                  <span className="text-slate-900 dark:text-slate-200">
                    {plan.site.name}
                  </span>
                </span>
              </div>
              {plan.site.code && (
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Job:{" "}
                    <span className="font-mono text-slate-900 dark:text-slate-200">
                      {plan.site.code}
                    </span>
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Product:{" "}
                  <span className="text-slate-900 dark:text-slate-200">
                    {plan.product.name}
                  </span>
                </span>
              </div>
              {plan.boqReference && (
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    BOQ: {plan.boqReference}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Ruler className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Area:{" "}
                  <span className="font-mono text-slate-900 dark:text-slate-200">
                    {plan.areaM2.toLocaleString()} m²
                  </span>
                  {plan.coats > 1 && (
                    <span className="text-xs ml-1">× {plan.coats} coats</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => {
                  setUsageDialogOpen(true);
                  setUsageError("");
                }}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Record Usage
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Delete
              </Button>
            </div>
            <span className="text-xs text-muted-foreground">
              Created {formatDate(plan.createdAt)}
              {plan.createdByUser?.name && ` by ${plan.createdByUser.name}`}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <StatCard
          label="Planned"
          value={`${plan.roundedContainers} × ${plan.containerSizeLitresSnapshot ?? plan.product.unitSize ?? 20}L`}
          sub={`${plan.requiredLitres.toFixed(1)} L total`}
          icon={<Calculator className="h-4 w-4 text-indigo-500" />}
        />
        <StatCard
          label="Used"
          value={
            totalContainers > 0
              ? `${totalContainers.toFixed(1)} containers`
              : "—"
          }
          sub={totalLitres > 0 ? `${totalLitres.toFixed(1)} L` : "No usage yet"}
          icon={<Package className="h-4 w-4 text-amber-500" />}
        />
        <StatCard
          label="Remaining"
          value={`${remaining.toFixed(1)} containers`}
          sub={`${pct.toFixed(0)}% consumed`}
          icon={
            alert === "critical" ? (
              <AlertTriangle className="h-4 w-4 text-red-500" />
            ) : alert === "warning" ? (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            )
          }
        />
        <StatCard
          label="Estimated Cost"
          value={
            plan.estimatedCost != null
              ? `R ${plan.estimatedCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
              : "—"
          }
          sub={
            plan.coverage
              ? `Coverage: ${plan.coverage.coverageM2PerLitre} m²/L`
              : `Coverage: ${plan.coverageM2PerLitreSnapshot} m²/L`
          }
          icon={<Calculator className="h-4 w-4 text-emerald-500" />}
        />
      </div>

      {/* Progress bar */}
      <div className="mb-4 rounded border border-slate-200/50 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/40 backdrop-blur-sm p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Usage Progress</span>
          <span className="text-sm font-mono">{pct.toFixed(0)}%</span>
        </div>
        <Progress
          value={pct}
          className={`h-3 ${
            alert === "critical"
              ? "[&>[data-slot=progress-indicator]]:bg-red-500"
              : alert === "warning"
                ? "[&>[data-slot=progress-indicator]]:bg-amber-500"
                : "[&>[data-slot=progress-indicator]]:bg-green-500"
          }`}
        />
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span>0%</span>
          <span className="text-amber-600 font-medium">50% Alert</span>
          <span>100%</span>
        </div>
      </div>

      {/* Note */}
      {plan.note && (
        <div className="mb-3 rounded border border-slate-200/50 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/40 p-4 shadow-sm">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Note
          </span>
          <p className="mt-1 text-sm">{plan.note}</p>
        </div>
      )}

      {/* Usage History Table */}
      <div className="rounded border border-slate-200/50 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/40 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/50 dark:border-slate-700/50">
          <h2 className="text-base font-semibold">Usage History</h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setUsageDialogOpen(true);
              setUsageError("");
            }}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Record Usage
          </Button>
        </div>

        {plan.usages.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            No usage recorded yet. Click &quot;Record Usage&quot; to track paint
            consumption.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="border-collapse [&_th]:border [&_th]:border-slate-200 [&_th]:dark:border-slate-700 [&_td]:border [&_td]:border-slate-200 [&_td]:dark:border-slate-700">
              <TableHeader className="bg-muted/60">
                <TableRow>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">
                    Date
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-right">
                    Litres
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-right">
                    Containers
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">
                    Note
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">
                    Recorded By
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide w-10">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plan.usages.map((u) => (
                  <TableRow
                    key={u.id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                  >
                    <TableCell className="text-sm">
                      {formatDate(u.usedOn)}
                    </TableCell>
                    <TableCell className="text-sm text-right font-mono">
                      {u.usedLitres ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-right font-mono">
                      {u.usedContainers ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">{u.note ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.createdByUser?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive"
                        onClick={() => handleDeleteUsage(u.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Record Usage Dialog */}
      <Dialog open={usageDialogOpen} onOpenChange={setUsageDialogOpen}>
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
            <Button variant="outline" onClick={() => setUsageDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddUsage} disabled={submitting}>
              {submitting ? "Saving..." : "Save Usage"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <ConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Paint Plan?"
        description={`This will permanently delete "${plan.description}" and all its usage records. This action cannot be undone.`}
        onConfirm={handleDeletePlan}
        isLoading={isDeleting}
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded border border-slate-200/50 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/40 backdrop-blur-sm p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className="text-lg font-bold text-slate-900 dark:text-white">
        {value}
      </div>
      <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}
