"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { toast } from "react-toastify";
import {
  Plus,
  Trash2,
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  PackagePlus,
  RotateCcw,
  ChevronsUpDown,
  Check,
  Printer,
  Pencil,
  BadgeCheck,
  Receipt,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ConfirmationDialog } from "@/components/common/ConfirmationDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import OrdersPOS, { type AdminForemanDto } from "@/components/orders/OrdersPOS";
import type { AdminProductDto } from "@/components/products/ProductsList";
import { formatCurrency } from "@/lib/formatCurrency";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type OrderItem = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  size: string | null;
  color: string | null;
  note: string | null;
  deductions: {
    id: string;
    applyTo: string;
    quantity: number | null;
    amount: string | null;
  }[];
};

type Order = {
  id: string;
  reference: string | null;
  foremanId: string | null;
  adminUserId: string | null;
  isAdminOrder: boolean;
  foremanName: string;
  status: string;
  createdAt: string;
  items: OrderItem[];
};

type ParsedItem = {
  rawDescription: string;
  productCode: string;
  quantity: number;
  unit: string;
  matched: boolean;
  confidence: number;
  productId: string | null;
  productName: string | null;
  productCategory: string | null;
};

type ParseResult = {
  orderNumber: string;
  vendorName: string | null;
  foremanNameHint: string | null;
  suggestedForemanId: string | null;
  createdDate: string | null;
  isStockOrder: boolean;
  items: ParsedItem[];
};

type ImportRowState = {
  productId: string | null;
  quantity: number;
  include: boolean;
};

type CreateOrderMode = "choose" | "manual" | "buildsmart";

interface OrdersPageClientProps {
  foremen: AdminForemanDto[];
  products: AdminProductDto[];
  category?: "PPE" | "TOOL";
  createTrigger?: number;
  hideHeader?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function statusBadgeVariant(status: string) {
  switch (status) {
    case "DEDUCTED":
    case "APPLIED":
    case "COLLECTED":
      return "default" as const;
    case "PENDING":
      return "secondary" as const;
    case "PARTIALLY_APPLIED":
      return "outline" as const;
    case "CANCELLED":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "DEDUCTED":
    case "APPLIED":
      return "Deducted";
    case "COLLECTED":
      return "Collected";
    case "PENDING":
      return "Pending";
    case "PARTIALLY_APPLIED":
      return "Partial Deduction";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

const ORDER_STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "COLLECTED", label: "Collected" },
  { value: "DEDUCTED", label: "Deducted" },
  { value: "CANCELLED", label: "Cancelled" },
] as const;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function orderTotal(items: OrderItem[]) {
  return items.reduce((sum, i) => sum + Number(i.unitPrice) * i.quantity, 0);
}

function buildOrderNumber(order: Order) {
  const d = new Date(order.createdAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `PO-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${order.id.slice(-6).toUpperCase()}`;
}

/* ------------------------------------------------------------------ */
/*  Foreman Combobox (searchable)                                      */
/* ------------------------------------------------------------------ */

function ForemanCombobox({
  foremen,
  value,
  onChange,
}: {
  foremen: AdminForemanDto[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = foremen.find((f) => f.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selected ? selected.name || selected.email : "— select foreman —"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Search foreman…" />
          <CommandList>
            <CommandEmpty>No foreman found.</CommandEmpty>
            <CommandGroup>
              {foremen.map((f) => (
                <CommandItem
                  key={f.id}
                  value={f.name || f.email || f.id}
                  onSelect={() => {
                    onChange(f.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={`mr-2 h-4 w-4 ${value === f.id ? "opacity-100" : "opacity-0"}`}
                  />
                  {f.name || f.email}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/*  Create Deduction Dialog                                            */
/* ------------------------------------------------------------------ */

type ForemanSite = {
  id: string;
  name: string;
  code: string | null;
  client: string | null;
};

function CreateDeductionDialog({
  open,
  order,
  onClose,
  onSuccess,
}: {
  open: boolean;
  order: Order | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [applyTo, setApplyTo] = useState<"CURRENT" | "NEXT">("CURRENT");
  const [split, setSplit] = useState<1 | 2>(1);
  const [siteId, setSiteId] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [sites, setSites] = useState<ForemanSite[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);

  // Reset form and load sites when dialog opens for a new order
  useEffect(() => {
    if (!open || !order?.foremanId) return;
    setApplyTo("CURRENT");
    setSplit(1);
    setSiteId("");
    setNote("");
    setSites([]);

    setLoadingSites(true);
    fetch(`/api/app/admin/foreman/${order.foremanId}/sites`, {
      credentials: "include",
      headers: { accept: "application/json" },
    })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.sites)) setSites(data.sites);
      })
      .catch(() => {
        /* non-critical */
      })
      .finally(() => setLoadingSites(false));
  }, [open, order?.foremanId, order?.id]);

  async function handleSubmit() {
    if (!order || !order.foremanId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/app/admin/deductions", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          foremanId: order.foremanId,
          type: "PRODUCT",
          applyTo,
          orderId: order.id,
          splitFortnights: split,
          siteId: siteId || undefined,
          note: note.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to create deduction");
      toast.success(
        "Deduction created — order marked as deducted from foreman pay",
      );
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create deduction");
    } finally {
      setSaving(false);
    }
  }

  if (!order) return null;

  const selectedSite = sites.find((s) => s.id === siteId);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Deduction from Order</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-md bg-muted px-3 py-2 text-sm space-y-0.5">
            <p className="font-medium">{order.foremanName}</p>
            <p className="text-muted-foreground">
              {order.items.length} item{order.items.length !== 1 ? "s" : ""} ·{" "}
              {formatCurrency(orderTotal(order.items))}
            </p>
            <p className="text-xs text-muted-foreground pt-1">
              Deduction will be applied to this foreman&apos;s grand total pay.
            </p>
          </div>

          {/* Site picker */}
          <div className="space-y-1.5">
            <Label htmlFor="deduct-site">Site</Label>
            {loadingSites ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading sites…
              </div>
            ) : sites.length === 0 ? (
              <p className="text-xs text-muted-foreground py-1">
                No active site assignments found for this foreman.
              </p>
            ) : (
              <Select value={siteId} onValueChange={setSiteId}>
                <SelectTrigger id="deduct-site">
                  <SelectValue placeholder="— select site —" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {sites.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                      {s.code ? ` (${s.code})` : ""}
                      {s.client ? ` — ${s.client}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selectedSite && (
              <p className="text-xs text-muted-foreground">
                Deduction will be linked to{" "}
                <span className="font-medium">{selectedSite.name}</span>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="deduct-apply">Apply To Fortnight</Label>
            <Select
              value={applyTo}
              onValueChange={(v) => setApplyTo(v as "CURRENT" | "NEXT")}
            >
              <SelectTrigger id="deduct-apply">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CURRENT">Current Fortnight</SelectItem>
                <SelectItem value="NEXT">Next Fortnight</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="deduct-split">Payment Split</Label>
            <Select
              value={String(split)}
              onValueChange={(v) => setSplit(Number(v) as 1 | 2)}
            >
              <SelectTrigger id="deduct-split">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Full amount this fortnight</SelectItem>
                <SelectItem value="2">Half now, half next fortnight</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="deduct-note">Note (optional)</Label>
            <Input
              id="deduct-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. PPE issued on site"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || (sites.length > 0 && !siteId)}
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Receipt className="mr-2 h-4 w-4" />
            )}
            Create Deduction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Edit Order Sheet                                                   */
/* ------------------------------------------------------------------ */

function EditOrderSheet({
  open,
  order,
  products,
  onClose,
  onSuccess,
}: {
  open: boolean;
  order: Order | null;
  products: AdminProductDto[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  type EditRow = {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    size: string | null;
    color: string | null;
    note: string | null;
  };

  const [rows, setRows] = useState<EditRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [addProductId, setAddProductId] = useState("");

  useEffect(() => {
    if (order) {
      setRows(
        order.items.map((i) => ({
          productId: i.productId,
          productName: i.productName,
          quantity: i.quantity,
          unitPrice: Number(i.unitPrice),
          size: i.size,
          color: i.color,
          note: i.note,
        })),
      );
      setAddProductId("");
    }
  }, [order?.id, open]);

  const selectedProduct = products.find((p) => p.id === addProductId);

  function addProduct() {
    if (!selectedProduct) return;
    setRows((prev) => [
      ...prev,
      {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        quantity: 1,
        unitPrice: Number(selectedProduct.price),
        size: null,
        color: null,
        note: null,
      },
    ]);
    setAddProductId("");
  }

  async function handleSave() {
    if (!order) return;
    if (rows.length === 0) {
      toast.error("Order must have at least one item");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/app/admin/orders/${order.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: rows.map((r) => ({
            productId: r.productId,
            quantity: r.quantity,
            ...(r.size ? { size: r.size } : {}),
            ...(r.color ? { color: r.color } : {}),
            ...(r.note ? { note: r.note } : {}),
          })),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to update order");
      toast.success("Order updated");
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update order");
    } finally {
      setSaving(false);
    }
  }

  const total = rows.reduce((s, r) => s + r.unitPrice * r.quantity, 0);

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto"
      >
        <SheetHeader className="mb-4">
          <SheetTitle>Edit Order — {order?.foremanName}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4">
          {/* Existing items */}
          <div className="border rounded overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="w-24 text-right">Qty</TableHead>
                  <TableHead className="w-28 text-right">Unit Price</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-sm text-muted-foreground h-16"
                    >
                      No items — add at least one below
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row, i) => (
                    <TableRow key={`${row.productId}-${i}`}>
                      <TableCell className="text-sm">
                        <p className="font-medium">{row.productName}</p>
                        {(row.size || row.color) && (
                          <p className="text-xs text-muted-foreground">
                            {[row.size, row.color].filter(Boolean).join(" / ")}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={1}
                          value={row.quantity}
                          onChange={(e) =>
                            setRows((prev) => {
                              const next = [...prev];
                              next[i] = {
                                ...next[i],
                                quantity: Math.max(1, Number(e.target.value)),
                              };
                              return next;
                            })
                          }
                          className="h-7 w-20 text-sm text-right ml-auto"
                        />
                      </TableCell>
                      <TableCell className="text-sm text-right">
                        {formatCurrency(row.unitPrice)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            setRows((prev) =>
                              prev.filter((_, idx) => idx !== i),
                            )
                          }
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Add product */}
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label>Add Product</Label>
              <Select value={addProductId} onValueChange={setAddProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="— select product to add —" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      [{p.category}] {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              onClick={addProduct}
              disabled={!addProductId}
            >
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <div className="text-sm font-medium">
              Total: <span className="font-bold">{formatCurrency(total)}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || rows.length === 0}
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/*  BuildSmart Import Tab                                              */
/* ------------------------------------------------------------------ */

function BuildSmartImportTab({
  foremen,
  products,
  onOrderCreated,
}: {
  foremen: AdminForemanDto[];
  products: AdminProductDto[];
  onOrderCreated: () => void;
}) {
  const [step, setStep] = useState<"upload" | "review" | "done">("upload");
  const [isParsing, setIsParsing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [rows, setRows] = useState<ImportRowState[]>([]);
  const [foremanId, setForemanId] = useState("");
  const [doneForemanName, setDoneForemanName] = useState("");
  const [doneCount, setDoneCount] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function parseFile(file: File) {
    setIsParsing(true);
    try {
      const fd = new FormData();
      fd.append("pdf", file);
      const res = await fetch("/api/app/admin/stock-receipts/parse", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Parse failed");
      const result = json as ParseResult;
      setParsed(result);
      setRows(
        result.items.map((item: ParsedItem) => ({
          productId: item.productId,
          quantity: item.quantity,
          include: item.matched,
        })),
      );
      if (result.suggestedForemanId) setForemanId(result.suggestedForemanId);
      setStep("review");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to parse PDF");
    } finally {
      setIsParsing(false);
    }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error("Select or drop a PDF first");
      return;
    }
    await parseFile(selectedFile);
  };

  const handleConfirm = async () => {
    if (!foremanId) {
      toast.error("Select a foreman first");
      return;
    }

    const items = rows
      .filter((r) => r.include && r.productId)
      .map((r) => ({ productId: r.productId!, quantity: r.quantity }));

    if (items.length === 0) {
      toast.error("No items selected");
      return;
    }

    setIsConfirming(true);
    try {
      const res = await fetch("/api/app/admin/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          foremanId,
          reference: parsed?.orderNumber ?? undefined,
          items,
          ...(parsed?.createdDate
            ? { createdAt: new Date(parsed.createdDate).toISOString() }
            : {}),
        }),
      });
      const json = await res.json();
      if (res.status === 409) {
        throw new Error(`PO #${parsed?.orderNumber} has already been imported`);
      }
      if (!res.ok) throw new Error(json.error || "Failed to create order");

      const fm = foremen.find((f) => f.id === foremanId);
      setDoneForemanName(fm?.name ?? "foreman");
      setDoneCount(items.length);
      toast.success(`Order created for ${fm?.name ?? "foreman"}`);
      onOrderCreated();
      setStep("done");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create order",
      );
    } finally {
      setIsConfirming(false);
    }
  };

  const reset = () => {
    setStep("upload");
    setParsed(null);
    setRows([]);
    setForemanId("");
    setSelectedFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const includedCount = rows.filter((r) => r.include && r.productId).length;

  if (step === "done") {
    return (
      <div className="py-12 text-center space-y-4">
        <CheckCircle2 className="mx-auto h-14 w-14 text-green-500" />
        <h2 className="text-xl font-semibold">Order Created</h2>
        <p className="text-sm text-muted-foreground">
          {doneCount} item{doneCount !== 1 ? "s" : ""} assigned to{" "}
          <strong>{doneForemanName}</strong>. View it in the Foreman Orders tab.
        </p>
        <Button onClick={reset} variant="outline">
          <RotateCcw className="mr-2 h-4 w-4" />
          Import Another
        </Button>
      </div>
    );
  }

  if (step === "review" && parsed) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">
              PO #{parsed.orderNumber}
              {parsed.vendorName ? ` · ${parsed.vendorName}` : ""}
            </p>
            <p className="text-sm text-muted-foreground">
              {parsed.items.length} line items parsed
              {parsed.createdDate && (
                <span className="ml-2 text-xs bg-muted px-1.5 py-0.5 rounded font-medium text-foreground">
                  PO date: {new Date(parsed.createdDate).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
              )}
              {parsed.isStockOrder && (
                <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                  STOCK order
                </span>
              )}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="mr-1.5 h-4 w-4" />
            Start Over
          </Button>
        </div>

        <div className="max-w-xs space-y-1.5">
          <Label>
            Assign to Foreman
            {parsed.foremanNameHint && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                (detected: {parsed.foremanNameHint})
              </span>
            )}
          </Label>
          <ForemanCombobox
            foremen={foremen}
            value={foremanId}
            onChange={setForemanId}
          />
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && rows.every((r) => r.include)}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) => ({ ...r, include: e.target.checked })),
                      )
                    }
                  />
                </TableHead>
                <TableHead>PDF Description</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="w-24">Qty</TableHead>
                <TableHead className="w-28">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parsed.items.map((item, i) => {
                const row = rows[i];
                if (!row) return null;
                return (
                  <TableRow
                    key={i}
                    className={!row.include ? "opacity-50" : undefined}
                  >
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={row.include}
                        onChange={(e) =>
                          setRows((prev) => {
                            const next = [...prev];
                            next[i] = { ...next[i], include: e.target.checked };
                            return next;
                          })
                        }
                      />
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="text-sm font-medium truncate">
                        {item.rawDescription}
                      </p>
                      {item.productCode && (
                        <p className="text-xs text-muted-foreground">
                          {item.productCode}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="min-w-52">
                      <Select
                        value={row.productId ?? "__none__"}
                        onValueChange={(val) =>
                          setRows((prev) => {
                            const next = [...prev];
                            next[i] = {
                              ...next[i],
                              productId: val === "__none__" ? null : val,
                              include: val !== "__none__",
                            };
                            return next;
                          })
                        }
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="— select product —" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          <SelectItem value="__none__">— skip —</SelectItem>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              [{p.category}] {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        value={row.quantity}
                        onChange={(e) =>
                          setRows((prev) => {
                            const next = [...prev];
                            next[i] = {
                              ...next[i],
                              quantity: Math.max(1, Number(e.target.value)),
                            };
                            return next;
                          })
                        }
                        className="h-8 w-20 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      {item.matched ? (
                        <Badge
                          variant="outline"
                          className="border-green-500 text-green-700 text-xs"
                        >
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Matched
                        </Badge>
                      ) : item.confidence > 0 ? (
                        <Badge
                          variant="outline"
                          className="border-amber-500 text-amber-700 text-xs"
                        >
                          <AlertCircle className="mr-1 h-3 w-3" />
                          Partial
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-red-400 text-red-600 text-xs"
                        >
                          <XCircle className="mr-1 h-3 w-3" />
                          Unmatched
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleConfirm}
            disabled={isConfirming || includedCount === 0 || !foremanId}
          >
            {isConfirming ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PackagePlus className="mr-2 h-4 w-4" />
            )}
            Create Order ({includedCount} item{includedCount !== 1 ? "s" : ""})
          </Button>
          <p className="text-sm text-muted-foreground">
            Adds a pending foreman order — apply deductions from the Foreman
            Orders tab.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-4">
      <p className="text-sm text-muted-foreground">
        Upload a BuildSmart PO PDF. Items are matched to the PPE &amp; Tools
        catalogue and added as a pending foreman order ready for deduction.
      </p>
      <form onSubmit={handleUpload} className="space-y-4">
        <div
          onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file && (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))) {
              setSelectedFile(file);
            } else if (file) {
              toast.error("Only PDF files are supported");
            }
          }}
          onClick={() => fileRef.current?.click()}
          className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            isDragging
              ? "border-primary bg-primary/5"
              : selectedFile
                ? "border-green-500 bg-green-500/5"
                : "border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/50"
          }`}
        >
          <Upload className={`mx-auto h-8 w-8 mb-3 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
          {selectedFile ? (
            <div>
              <p className="text-sm font-medium text-green-700">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground mt-1">Click to change file</p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium">
                {isDragging ? "Drop PDF here" : "Drag & drop a PDF or click to browse"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">BuildSmart PO PDF only</p>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setSelectedFile(file);
              e.currentTarget.value = "";
            }}
          />
        </div>
        <Button type="submit" disabled={isParsing || !selectedFile}>
          {isParsing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          {isParsing ? "Parsing PDF…" : "Upload & Parse"}
        </Button>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function OrdersPageClient({
  foremen,
  products,
  category,
  createTrigger,
  hideHeader = false,
}: OrdersPageClientProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(5);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [createOrderMode, setCreateOrderMode] =
    useState<CreateOrderMode>("choose");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(
    null,
  );
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [updatingStatusOrderId, setUpdatingStatusOrderId] = useState<
    string | null
  >(null);
  const [cancelDialogOrderId, setCancelDialogOrderId] = useState<string | null>(
    null,
  );
  const [deleteDialogOrderId, setDeleteDialogOrderId] = useState<string | null>(
    null,
  );
  const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);
  const [deductionDialogOrder, setDeductionDialogOrder] =
    useState<Order | null>(null);
  const [editSheetOrder, setEditSheetOrder] = useState<Order | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const url = category
        ? `/api/app/admin/orders?category=${category}`
        : "/api/app/admin/orders";
      const res = await fetch(url, {
        cache: "no-store",
        credentials: "include",
        headers: { accept: "application/json" },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to load orders");
      setOrders(Array.isArray(data?.orders) ? data.orders : []);
      setPageIndex(0);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load orders");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (createTrigger) openCreateOrder();
  }, [createTrigger]);

  const totalOrderValue = useMemo(
    () => orders.reduce((sum, o) => sum + orderTotal(o.items), 0),
    [orders],
  );

  const updateOrderStatus = useCallback(
    async (orderId: string, status: string) => {
      setUpdatingStatusOrderId(orderId);
      try {
        const res = await fetch(`/api/app/admin/orders/${orderId}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok)
          throw new Error(data?.error ?? "Failed to update order status");
        toast.success(`Order marked ${statusLabel(status).toLowerCase()}`);
        loadOrders();
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to update order status");
      } finally {
        setUpdatingStatusOrderId(null);
      }
    },
    [loadOrders],
  );

  const cancelOrder = useCallback(
    async (orderId: string) => {
      setCancellingOrderId(orderId);
      try {
        await updateOrderStatus(orderId, "CANCELLED");
      } finally {
        setCancellingOrderId(null);
      }
    },
    [updateOrderStatus],
  );

  const deleteOrder = useCallback(
    async (orderId: string) => {
      setDeletingOrderId(orderId);
      try {
        const res = await fetch(`/api/app/admin/orders/${orderId}`, {
          method: "DELETE",
          credentials: "include",
          headers: { accept: "application/json" },
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? "Failed to delete order");
        toast.success("Order deleted");
        loadOrders();
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to delete order");
      } finally {
        setDeletingOrderId(null);
      }
    },
    [loadOrders],
  );

  const printOrder = useCallback(async (order: Order) => {
    setPrintingOrderId(order.id);
    try {
      const d = new Date(order.createdAt);
      const issuedDate = d.toLocaleDateString("en-ZA", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      const voucherData = {
        orderNumber: order.reference ?? buildOrderNumber(order),
        issuedDate,
        recipientName: order.foremanName,
        recipientType: order.isAdminOrder ? "admin" : "foreman",
        items: order.items.map((i) => ({
          productName: i.productName,
          size: i.size ?? null,
          color: i.color ?? null,
          quantity: i.quantity,
          unitPrice: Number(i.unitPrice),
          note: i.note ?? null,
        })),
      };
      const res = await fetch("/api/app/admin/product-order/pdf", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(voucherData),
      });
      if (!res.ok) throw new Error("Failed to generate voucher");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast.error("Could not generate voucher PDF");
    } finally {
      setPrintingOrderId(null);
    }
  }, []);

  const handleOrderCreated = useCallback(() => {
    setSheetOpen(false);
    setCreateOrderMode("choose");
    loadOrders();
  }, [loadOrders]);

  const openCreateOrder = useCallback(() => {
    setCreateOrderMode("choose");
    setSheetOpen(true);
  }, []);

  const closeCreateOrder = useCallback((open: boolean) => {
    setSheetOpen(open);
    if (!open) setCreateOrderMode("choose");
  }, []);

  return (
    <div className="">
      {!hideHeader && (
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage order records from one clean creation flow.
            </p>
          </div>
          <Button onClick={openCreateOrder}>
            <Plus className="mr-2 h-4 w-4" />
            Create Order
          </Button>
        </div>
      )}

      {/* ── Foreman Orders Tab ── */}
      <div className="space-y-5">
        <div className="border rounded bg-card">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-semibold">Order #</TableHead>
                  <TableHead className="text-xs font-semibold">Date</TableHead>
                  <TableHead className="text-xs font-semibold">
                    Foreman
                  </TableHead>
                  <TableHead className="text-xs font-semibold">Items</TableHead>
                  <TableHead className="text-xs font-semibold text-right">
                    Total
                  </TableHead>
                  <TableHead className="text-xs font-semibold">
                    Status
                  </TableHead>
                  <TableHead className="text-xs font-semibold">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      <span className="text-muted-foreground text-sm">
                        Loading orders…
                      </span>
                    </TableCell>
                  </TableRow>
                ) : orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      <span className="text-muted-foreground text-sm">
                        No orders yet
                      </span>
                    </TableCell>
                  </TableRow>
                ) : (
                  orders
                    .slice(pageIndex * pageSize, (pageIndex + 1) * pageSize)
                    .map((order) => {
                    const isExpanded = expandedOrderId === order.id;
                    const isCancelled = order.status === "CANCELLED";
                    const isPending = order.status === "PENDING";
                    const isDeducted =
                      order.status === "DEDUCTED" || order.status === "APPLIED";
                    const isPrinting = printingOrderId === order.id;
                    const isUpdatingStatus = updatingStatusOrderId === order.id;

                    return (
                      <React.Fragment key={order.id}>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() =>
                            setExpandedOrderId(isExpanded ? null : order.id)
                          }
                        >
                          <TableCell className="text-sm">
                            {order.reference ? (
                              <span className="font-semibold text-foreground">
                                #{order.reference}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(order.createdAt)}
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            <span className="flex items-center gap-1.5">
                              {order.isAdminOrder && (
                                <span className="text-[10px] font-bold uppercase tracking-wide bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                                  Admin
                                </span>
                              )}
                              {order.foremanName}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">
                            {order.items.length} item
                            {order.items.length !== 1 ? "s" : ""}
                          </TableCell>
                          <TableCell className="text-sm font-semibold text-right">
                            {formatCurrency(orderTotal(order.items))}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Select
                                value={order.status}
                                onValueChange={(status) =>
                                  updateOrderStatus(order.id, status)
                                }
                                disabled={isUpdatingStatus}
                              >
                                <SelectTrigger
                                  className="h-8 w-36 text-xs"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <SelectValue>
                                    {isUpdatingStatus
                                      ? "Updating..."
                                      : statusLabel(order.status)}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {ORDER_STATUS_OPTIONS.map((option) => (
                                    <SelectItem
                                      key={option.value}
                                      value={option.value}
                                    >
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                  {order.status === "PARTIALLY_APPLIED" && (
                                    <SelectItem value="PARTIALLY_APPLIED">
                                      Partial Deduction
                                    </SelectItem>
                                  )}
                                  {order.status === "APPLIED" && (
                                    <SelectItem value="APPLIED">
                                      Deducted
                                    </SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                              <Badge
                                variant={statusBadgeVariant(order.status)}
                                className="hidden xl:inline-flex"
                              >
                                {statusLabel(order.status)}
                              </Badge>
                              {isDeducted && (
                                <div title="Deduction applied">
                                  <BadgeCheck className="h-4 w-4 text-green-600" />
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              {/* Print / Reprint */}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                disabled={isPrinting}
                                title="Print voucher"
                                onClick={() => printOrder(order)}
                              >
                                {isPrinting ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Printer className="h-3.5 w-3.5" />
                                )}
                              </Button>

                              {/* Edit — only for PENDING orders */}
                              {isPending && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                  title="Edit order"
                                  onClick={() => setEditSheetOrder(order)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              )}

                              {/* Create Deduction — only for PENDING foreman orders */}
                              {isPending && !order.isAdminOrder && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-amber-600"
                                  title="Create deduction"
                                  onClick={() => setDeductionDialogOrder(order)}
                                >
                                  <Receipt className="h-3.5 w-3.5" />
                                </Button>
                              )}

                              {!isCancelled && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  disabled={cancellingOrderId === order.id}
                                  title="Cancel order"
                                  onClick={() =>
                                    setCancelDialogOrderId(order.id)
                                  }
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                </Button>
                              )}

                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                disabled={deletingOrderId === order.id}
                                title="Delete order"
                                onClick={() => setDeleteDialogOrderId(order.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow className="bg-muted/30">
                            <TableCell colSpan={7} className="p-0">
                              <div className="px-6 py-3 space-y-2">
                                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                  Order Items
                                </div>
                                <Table>
                                  <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                      <TableHead className="text-xs">
                                        Product
                                      </TableHead>
                                      <TableHead className="text-xs">
                                        Size
                                      </TableHead>
                                      <TableHead className="text-xs">
                                        Color
                                      </TableHead>
                                      <TableHead className="text-xs text-right">
                                        Qty
                                      </TableHead>
                                      <TableHead className="text-xs text-right">
                                        Unit Price
                                      </TableHead>
                                      <TableHead className="text-xs text-right">
                                        Subtotal
                                      </TableHead>
                                      <TableHead className="text-xs">
                                        Note
                                      </TableHead>
                                      <TableHead className="text-xs">
                                        Deducted
                                      </TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {order.items.map((item) => {
                                      const hasDeduction =
                                        item.deductions.length > 0;
                                      return (
                                        <TableRow
                                          key={item.id}
                                          className="hover:bg-transparent"
                                        >
                                          <TableCell className="text-sm">
                                            {item.productName}
                                          </TableCell>
                                          <TableCell className="text-sm text-muted-foreground">
                                            {item.size || "—"}
                                          </TableCell>
                                          <TableCell className="text-sm text-muted-foreground">
                                            {item.color || "—"}
                                          </TableCell>
                                          <TableCell className="text-sm text-right">
                                            {item.quantity}
                                          </TableCell>
                                          <TableCell className="text-sm text-right">
                                            {formatCurrency(
                                              Number(item.unitPrice),
                                            )}
                                          </TableCell>
                                          <TableCell className="text-sm font-medium text-right">
                                            {formatCurrency(
                                              Number(item.unitPrice) *
                                                item.quantity,
                                            )}
                                          </TableCell>
                                          <TableCell className="text-sm text-muted-foreground">
                                            {item.note || "—"}
                                          </TableCell>
                                          <TableCell>
                                            {hasDeduction ? (
                                              <Badge
                                                variant="outline"
                                                className="border-green-500 text-green-700 text-xs"
                                              >
                                                <BadgeCheck className="mr-1 h-3 w-3" />
                                                Yes
                                              </Badge>
                                            ) : (
                                              <span className="text-xs text-muted-foreground">
                                                No
                                              </span>
                                            )}
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Pagination */}
      {orders.length > 0 && (
        <div className="flex items-center justify-between border-t px-4 py-3 bg-muted/60">
          <div className="text-muted-foreground hidden text-sm lg:flex">
            Showing{" "}
            {pageIndex * pageSize + 1} to{" "}
            {Math.min((pageIndex + 1) * pageSize, orders.length)} of{" "}
            {orders.length} orders
          </div>
          <div className="flex w-full items-center gap-4 lg:w-fit lg:gap-8">
            <div className="hidden items-center gap-2 lg:flex">
              <span className="text-sm font-medium">Rows per page</span>
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  setPageSize(Number(value));
                  setPageIndex(0);
                }}
              >
                <SelectTrigger className="h-8 w-20">
                  <SelectValue placeholder={pageSize} />
                </SelectTrigger>
                <SelectContent side="top">
                  {[5, 10, 25, 50, 100].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-fit items-center justify-center text-sm font-medium">
              Page {pageIndex + 1} of {Math.max(1, Math.ceil(orders.length / pageSize))}
            </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Button
                variant="outline"
                size="icon"
                className="hidden h-8 w-8 lg:flex"
                onClick={() => setPageIndex(0)}
                disabled={pageIndex === 0}
              >
                <span className="sr-only">Go to first page</span>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPageIndex((i) => i - 1)}
                disabled={pageIndex === 0}
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPageIndex((i) => i + 1)}
                disabled={(pageIndex + 1) * pageSize >= orders.length}
              >
                <span className="sr-only">Go to next page</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="hidden h-8 w-8 lg:flex"
                onClick={() => setPageIndex(Math.ceil(orders.length / pageSize) - 1)}
                disabled={(pageIndex + 1) * pageSize >= orders.length}
              >
                <span className="sr-only">Go to last page</span>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* New Order Sheet */}
      <Sheet open={sheetOpen} onOpenChange={closeCreateOrder}>
        <SheetContent
          side="right"
          className={
            createOrderMode === "choose"
              ? "w-full sm:max-w-xl overflow-y-auto"
              : "w-full sm:max-w-full lg:max-w-[85vw] p-0 overflow-y-auto"
          }
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Create Order</SheetTitle>
          </SheetHeader>
          {createOrderMode === "choose" ? (
            <div className="space-y-5 p-6">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">
                  Create Order
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose the type of order you want to create.
                </p>
              </div>
              <div className="grid gap-3">
                <button
                  type="button"
                  onClick={() => setCreateOrderMode("manual")}
                  className="rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-muted/40"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-md bg-primary/10 p-2 text-primary">
                      <PackagePlus className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-semibold">
                        Product / PPE & Tools Order
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Create an order manually for a foreman or admin using
                        the shared product order form.
                      </div>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setCreateOrderMode("buildsmart")}
                  className="rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-muted/40"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-md bg-primary/10 p-2 text-primary">
                      <Upload className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-semibold">Import BuildSmart PO</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Upload a BuildSmart PDF and confirm the matched products
                        before creating the order.
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          ) : createOrderMode === "manual" ? (
            <OrdersPOS
              foremen={foremen}
              products={products}
              requireReference={category === "TOOL"}
              onOrderCreated={handleOrderCreated}
            />
          ) : (
            <div className="p-6">
              <div className="mb-5 flex items-center justify-between gap-3 border-b pb-4">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">
                    Import BuildSmart PO
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Upload the PDF, review the matches, then create the order.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setCreateOrderMode("choose")}
                >
                  Back
                </Button>
              </div>
              <BuildSmartImportTab
                foremen={foremen}
                products={products}
                onOrderCreated={handleOrderCreated}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Edit Order Sheet */}
      <EditOrderSheet
        open={editSheetOrder !== null}
        order={editSheetOrder}
        products={products}
        onClose={() => setEditSheetOrder(null)}
        onSuccess={loadOrders}
      />

      {/* Create Deduction Dialog */}
      <CreateDeductionDialog
        open={deductionDialogOrder !== null}
        order={deductionDialogOrder}
        onClose={() => setDeductionDialogOrder(null)}
        onSuccess={loadOrders}
      />

      <ConfirmationDialog
        open={cancelDialogOrderId !== null}
        onOpenChange={(open) => {
          if (!open) setCancelDialogOrderId(null);
        }}
        title="Cancel Order?"
        description="This will mark the order as cancelled, remove any linked unpaid deductions, and restore PPE stock quantities."
        onConfirm={() => {
          if (cancelDialogOrderId) {
            cancelOrder(cancelDialogOrderId);
            setCancelDialogOrderId(null);
          }
        }}
        isLoading={cancellingOrderId !== null}
        confirmText="Cancel Order"
        variant="destructive"
      />

      <ConfirmationDialog
        open={deleteDialogOrderId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteDialogOrderId(null);
        }}
        title="Delete Order?"
        description="This will permanently delete the order record. If it is not already cancelled, PPE stock will be restored first."
        onConfirm={() => {
          if (deleteDialogOrderId) {
            deleteOrder(deleteDialogOrderId);
            setDeleteDialogOrderId(null);
          }
        }}
        isLoading={deletingOrderId !== null}
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  );
}
