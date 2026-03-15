"use client";

import { useState } from "react";
import type { PaintPlan } from "@/types/paint-planning";
import {
  addPaintUsage,
  deletePaintPlan,
  deletePaintUsage,
} from "@/actions/paint-planning";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Plus,
  MoreVertical,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

type Props = {
  plans: PaintPlan[];
  onRefresh: () => void;
};

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

export function PaintTrackingTable({ plans, onRefresh }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [usageDialogPlanId, setUsageDialogPlanId] = useState<string | null>(
    null,
  );
  const [usageLitres, setUsageLitres] = useState("");
  const [usageContainers, setUsageContainers] = useState("");
  const [usageNote, setUsageNote] = useState("");
  const [usageDate, setUsageDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleAddUsage() {
    if (!usageDialogPlanId) return;
    setError("");
    const litres = parseFloat(usageLitres) || null;
    const containers = parseFloat(usageContainers) || null;
    if (!litres && !containers) {
      setError("Enter litres or containers used.");
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
      setError(res.error);
      return;
    }
    setUsageDialogPlanId(null);
    setUsageLitres("");
    setUsageContainers("");
    setUsageNote("");
    setUsageDate("");
    onRefresh();
  }

  async function handleDeletePlan(planId: string) {
    if (!confirm("Delete this paint plan and all its usage records?")) return;
    await deletePaintPlan(planId);
    onRefresh();
  }

  async function handleDeleteUsage(usageId: string) {
    if (!confirm("Delete this usage entry?")) return;
    await deletePaintUsage(usageId);
    onRefresh();
  }

  if (plans.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground text-sm">
          No paint plans yet. Use the form above to create one.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            Paint Plans & Usage Tracking
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Description</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Area m²</TableHead>
                  <TableHead className="text-right">Planned</TableHead>
                  <TableHead className="text-right">Used</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead className="w-40">Progress</TableHead>
                  <TableHead>Alert</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => {
                  const { totalContainers, totalLitres } = getUsageTotals(plan);
                  const remaining = plan.roundedContainers - totalContainers;
                  const pct = getProgressPercent(plan);
                  const alert = getAlertStatus(plan);
                  const isExpanded = expandedId === plan.id;

                  return (
                    <>
                      <TableRow
                        key={plan.id}
                        className={
                          alert === "critical"
                            ? "bg-red-50 dark:bg-red-950/20"
                            : alert === "warning"
                              ? "bg-amber-50 dark:bg-amber-950/20"
                              : ""
                        }
                      >
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() =>
                              setExpandedId(isExpanded ? null : plan.id)
                            }
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">
                            {plan.description}
                          </div>
                          {plan.boqReference && (
                            <div className="text-xs text-muted-foreground">
                              BOQ: {plan.boqReference}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {plan.site.name}
                        </TableCell>
                        <TableCell className="text-sm">
                          {plan.product.name}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {plan.areaM2.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {plan.roundedContainers} ×{" "}
                          {plan.product.unitSize ?? 20}L
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {totalContainers > 0
                            ? `${totalContainers.toFixed(1)}`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {remaining.toFixed(1)}
                        </TableCell>
                        <TableCell>
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
                        </TableCell>
                        <TableCell>
                          {alert === "critical" ? (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Near limit
                            </Badge>
                          ) : alert === "warning" ? (
                            <Badge
                              variant="outline"
                              className="text-xs border-amber-500 text-amber-700 dark:text-amber-400"
                            >
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              50%+
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-xs text-green-700 dark:text-green-400"
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              OK
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setUsageDialogPlanId(plan.id);
                                  setError("");
                                }}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Record Usage
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleDeletePlan(plan.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Plan
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>

                      {/* Expanded: usage history */}
                      {isExpanded && (
                        <TableRow key={`${plan.id}-detail`}>
                          <TableCell />
                          <TableCell colSpan={10}>
                            <div className="py-2 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-muted-foreground uppercase">
                                  Usage History
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => {
                                    setUsageDialogPlanId(plan.id);
                                    setError("");
                                  }}
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Record Usage
                                </Button>
                              </div>
                              {plan.usages.length === 0 ? (
                                <p className="text-xs text-muted-foreground">
                                  No usage recorded yet.
                                </p>
                              ) : (
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Date</TableHead>
                                      <TableHead className="text-right">
                                        Litres
                                      </TableHead>
                                      <TableHead className="text-right">
                                        Containers
                                      </TableHead>
                                      <TableHead>Note</TableHead>
                                      <TableHead className="w-8" />
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {plan.usages.map((u) => (
                                      <TableRow key={u.id}>
                                        <TableCell className="text-xs">
                                          {new Date(
                                            u.usedOn,
                                          ).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell className="text-right text-xs font-mono">
                                          {u.usedLitres ?? "—"}
                                        </TableCell>
                                        <TableCell className="text-right text-xs font-mono">
                                          {u.usedContainers ?? "—"}
                                        </TableCell>
                                        <TableCell className="text-xs">
                                          {u.note ?? "—"}
                                        </TableCell>
                                        <TableCell>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0 text-destructive"
                                            onClick={() =>
                                              handleDeleteUsage(u.id)
                                            }
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              )}
                              {plan.estimatedCost != null && (
                                <div className="text-xs text-muted-foreground">
                                  Estimated cost: R{" "}
                                  {plan.estimatedCost.toLocaleString(
                                    undefined,
                                    {
                                      minimumFractionDigits: 2,
                                    },
                                  )}
                                </div>
                              )}
                              {plan.note && (
                                <div className="text-xs text-muted-foreground">
                                  Note: {plan.note}
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add Usage Dialog */}
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
            {error && (
              <p className="text-sm text-destructive flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                {error}
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
