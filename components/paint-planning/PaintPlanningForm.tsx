"use client";

import { useState, useMemo } from "react";
import {
  createPaintPlan,
  upsertCoverageProfile,
} from "@/actions/paint-planning";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/paint-planning/SearchableSelect";
import { AlertTriangle, Calculator, Save, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import type {
  SiteOption,
  ProductOption,
  CoverageOption,
} from "@/types/paint-planning";

type Props = {
  sites: SiteOption[];
  products: ProductOption[];
  coverages: CoverageOption[];
  onPlanCreated: () => void;
  onCoverageCreated: () => void;
};

export function PaintPlanningForm({
  sites,
  products,
  coverages,
  onPlanCreated,
  onCoverageCreated,
}: Props) {
  const [siteId, setSiteId] = useState("");
  const [description, setDescription] = useState("");
  const [boqReference, setBoqReference] = useState("");
  const [areaM2, setAreaM2] = useState("");
  const [productId, setProductId] = useState("");
  const [coverageId, setCoverageId] = useState("");
  const [coats, setCoats] = useState("1");
  const [coverageM2Override, setCoverageM2Override] = useState("");
  const [unitSizeLitres, setUnitSizeLitres] = useState("20");
  const [costPerContainer, setCostPerContainer] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Coverage dialog state
  const [coverageDialogOpen, setCoverageDialogOpen] = useState(false);
  const [newCoverageM2, setNewCoverageM2] = useState("");
  const [newCoverageUnitSize, setNewCoverageUnitSize] = useState("20");
  const [newCoverageNote, setNewCoverageNote] = useState("");
  const [savingCoverage, setSavingCoverage] = useState(false);

  // filtered coverages for selected product
  const productCoverages = useMemo(
    () => coverages.filter((c) => c.product.id === productId),
    [coverages, productId],
  );

  // selected coverage
  const selectedCoverage = useMemo(
    () => coverages.find((c) => c.id === coverageId),
    [coverages, coverageId],
  );

  // Effective values for calculation
  const effectiveCoverageM2 = coverageM2Override
    ? parseFloat(coverageM2Override)
    : selectedCoverage
      ? selectedCoverage.coverageM2
      : 0;
  const effectiveUnitSize = parseFloat(unitSizeLitres) || 0;
  const effectiveArea = (parseFloat(areaM2) || 0) * (parseInt(coats) || 1);
  const effectiveCost = parseFloat(costPerContainer) || 0;

  // Calculations
  const calc = useMemo(() => {
    if (!effectiveArea || !effectiveCoverageM2 || !effectiveUnitSize) {
      return null;
    }

    const containersNeeded = effectiveArea / effectiveCoverageM2;
    const litresNeeded = containersNeeded * effectiveUnitSize;
    const roundedContainers = Math.ceil(containersNeeded);
    const estimatedCost = effectiveCost
      ? roundedContainers * effectiveCost
      : null;
    const halfUsageLitres = litresNeeded / 2;
    const halfUsageContainers = containersNeeded / 2;

    return {
      containersNeeded,
      litresNeeded,
      roundedContainers,
      estimatedCost,
      halfUsageLitres,
      halfUsageContainers,
    };
  }, [effectiveArea, effectiveCoverageM2, effectiveUnitSize, effectiveCost]);

  async function handleSave() {
    setError("");
    if (!siteId || !description || !areaM2 || !productId) {
      setError("Please fill in site, description, area, and product.");
      return;
    }
    if (!effectiveCoverageM2) {
      setError("Select a coverage profile or enter a manual coverage rate.");
      return;
    }
    setSaving(true);
    const res = await createPaintPlan({
      siteId,
      description,
      boqReference: boqReference || null,
      areaM2: parseFloat(areaM2),
      productId,
      coverageId: coverageId || null,
      coats: parseInt(coats) || 1,
      coverageM2PerUnit: effectiveCoverageM2,
      unitSizeLitres: effectiveUnitSize,
      costPerContainer: effectiveCost || null,
      note: note || null,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    // Reset form
    setDescription("");
    setBoqReference("");
    setAreaM2("");
    setCoverageId("");
    setCoverageM2Override("");
    setCostPerContainer("");
    setNote("");
    onPlanCreated();
  }

  async function handleSaveCoverage() {
    if (!productId || !newCoverageM2) return;
    setSavingCoverage(true);
    await upsertCoverageProfile({
      productId,
      coverageM2: parseFloat(newCoverageM2),
      unitSize: parseFloat(newCoverageUnitSize) || null,
      uom: "L",
      note: newCoverageNote || null,
    });
    setSavingCoverage(false);
    setCoverageDialogOpen(false);
    setNewCoverageM2("");
    setNewCoverageNote("");
    onCoverageCreated();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Left: Form */}
      <Card className="lg:col-span-3">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">
            New Paint Plan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Site */}
            <div className="space-y-1.5">
              <Label className="text-xs">Site *</Label>
              <SearchableSelect
                value={siteId}
                onValueChange={setSiteId}
                placeholder="Search sites..."
                options={sites.map((s) => ({
                  value: s.id,
                  label: s.name + (s.code ? ` (${s.code})` : ""),
                }))}
              />
            </div>

            {/* Product */}
            <div className="space-y-1.5">
              <Label className="text-xs">Product *</Label>
              <SearchableSelect
                value={productId}
                onValueChange={(v) => {
                  setProductId(v);
                  setCoverageId("");
                }}
                placeholder="Search products..."
                options={products.map((p) => ({
                  value: p.id,
                  label: p.name + (p.sku ? ` (${p.sku})` : ""),
                }))}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">BOQ Description / Scope *</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. External walls — prime + 2 coats"
              />
            </div>

            {/* BOQ Ref */}
            <div className="space-y-1.5">
              <Label className="text-xs">BOQ Reference</Label>
              <Input
                value={boqReference}
                onChange={(e) => setBoqReference(e.target.value)}
                placeholder="e.g. Section 15.1"
              />
            </div>

            {/* Area */}
            <div className="space-y-1.5">
              <Label className="text-xs">Area (m²) *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={areaM2}
                onChange={(e) => setAreaM2(e.target.value)}
                placeholder="e.g. 1377"
              />
            </div>

            {/* Coverage profile */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Coverage Profile</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1.5 text-xs"
                  disabled={!productId}
                  onClick={() => setCoverageDialogOpen(true)}
                >
                  <Plus className="h-3 w-3 mr-0.5" />
                  New
                </Button>
              </div>
              {productCoverages.length > 0 ? (
                <Select
                  value={coverageId}
                  onValueChange={setCoverageId}
                  disabled={!productId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select or use manual" />
                  </SelectTrigger>
                  <SelectContent>
                    {productCoverages.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.coverageM2} m² / {c.unitSize ?? "?"}L
                        {c.note ? ` — ${c.note}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : productId ? (
                <Button
                  variant="outline"
                  className="w-full justify-start font-normal text-muted-foreground h-9"
                  onClick={() => setCoverageDialogOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  No profiles yet — click to add one
                </Button>
              ) : (
                <div className="text-xs text-muted-foreground border rounded px-3 py-2">
                  Select a product first
                </div>
              )}
            </div>

            {/* Manual coverage override */}
            <div className="space-y-1.5">
              <Label className="text-xs">Manual Coverage (m² per unit)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={coverageM2Override}
                onChange={(e) => setCoverageM2Override(e.target.value)}
                placeholder="Overrides profile"
              />
            </div>

            {/* Coats */}
            <div className="space-y-1.5">
              <Label className="text-xs">Coats</Label>
              <Select value={coats} onValueChange={setCoats}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 coat</SelectItem>
                  <SelectItem value="2">2 coats</SelectItem>
                  <SelectItem value="3">3 coats</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Unit size */}
            <div className="space-y-1.5">
              <Label className="text-xs">Container Size (litres)</Label>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={unitSizeLitres}
                onChange={(e) => setUnitSizeLitres(e.target.value)}
                placeholder="e.g. 20"
              />
            </div>

            {/* Cost per container */}
            <div className="space-y-1.5">
              <Label className="text-xs">Cost per Container (R)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={costPerContainer}
                onChange={(e) => setCostPerContainer(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <Label className="text-xs">Note</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional notes"
              rows={2}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              {error}
            </p>
          )}

          <Button onClick={handleSave} disabled={saving} className="w-full">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Paint Plan"}
          </Button>
        </CardContent>
      </Card>

      {/* Right: Results Card */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Calculation
          </CardTitle>
        </CardHeader>
        <CardContent>
          {calc ? (
            <div className="space-y-3">
              <Row
                label="Area"
                value={`${(parseFloat(areaM2) || 0).toLocaleString()} m²`}
              />
              {parseInt(coats) > 1 && (
                <Row
                  label="Effective area"
                  value={`${effectiveArea.toLocaleString()} m² (${coats} coats)`}
                  muted
                />
              )}
              <Row
                label="Coverage"
                value={`${effectiveCoverageM2} m² per ${effectiveUnitSize}L`}
              />
              <div className="border-t pt-3 space-y-3">
                <Row
                  label="Litres needed"
                  value={`${calc.litresNeeded.toFixed(2)} L`}
                  bold
                />
                <Row
                  label="Containers"
                  value={calc.containersNeeded.toFixed(2)}
                />
                <Row
                  label="Order quantity"
                  value={`${calc.roundedContainers} × ${effectiveUnitSize}L`}
                  bold
                />
                {calc.estimatedCost != null && (
                  <Row
                    label="Estimated cost"
                    value={`R ${calc.estimatedCost.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}`}
                    bold
                  />
                )}
              </div>
              <div className="border-t pt-3 space-y-2">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  50% Alert Threshold
                </div>
                <Row
                  label="Litres"
                  value={`${calc.halfUsageLitres.toFixed(1)} L`}
                />
                <Row
                  label="Containers"
                  value={`${calc.halfUsageContainers.toFixed(1)} buckets`}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Enter area, product, and coverage to see calculations
            </p>
          )}
        </CardContent>
      </Card>

      {/* Coverage Profile Dialog */}
      <Dialog open={coverageDialogOpen} onOpenChange={setCoverageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Coverage Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Coverage per unit (m²)</Label>
              <Input
                type="number"
                value={newCoverageM2}
                onChange={(e) => setNewCoverageM2(e.target.value)}
                placeholder="e.g. 140"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Unit size (litres)</Label>
              <Input
                type="number"
                value={newCoverageUnitSize}
                onChange={(e) => setNewCoverageUnitSize(e.target.value)}
                placeholder="e.g. 20"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Note</Label>
              <Input
                value={newCoverageNote}
                onChange={(e) => setNewCoverageNote(e.target.value)}
                placeholder="e.g. 2 coats on smooth plaster"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleSaveCoverage}
              disabled={savingCoverage || !newCoverageM2}
            >
              {savingCoverage ? "Saving..." : "Save Profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <span className={bold ? "font-semibold" : "font-mono"}>{value}</span>
    </div>
  );
}
