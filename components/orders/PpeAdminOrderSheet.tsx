"use client";

import * as React from "react";
import { toast } from "react-toastify";
import { Check, ChevronsUpDown, Loader2, Plus, Printer, X } from "lucide-react";
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
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PpeProductDto {
  id: string;
  name: string;
  sku: string | null;
  colors: string[];
  sizes: string[];
  isDeductible: boolean;
  unitPrice: number | null;
}

export interface PpeAdminSupervisorDto {
  id: string;
  name: string | null;
  email: string;
  sites: { id: string; name: string; code: string | null }[];
  foremen: { id: string; name: string }[];
}

interface PpeAdminOrderSheetProps {
  supervisors: PpeAdminSupervisorDto[];
  products: PpeProductDto[];
  onCreated?: () => void;
}

type PpeCartItem = {
  rowId: string;
  productId: string;
  productName: string;
  size: string;
  color: string;
  quantity: number;
  unitPrice: number | null;
  isDeductible: boolean;
};

type ForemanCart = {
  foremanId: string;
  foremanName: string;
  siteId: string;
  siteName: string;
  siteCode: string | null;
  chargeToSite: boolean;
  items: PpeCartItem[];
};

type LastOrder = {
  orderNumber: string;
  issuedDate: string;
  supervisorName: string;
  foremen: {
    foremanName: string;
    siteName: string | null;
    siteCode: string | null;
    chargeToSite: boolean;
    items: {
      productName: string;
      size: string | null;
      color: string | null;
      quantity: number;
      unitPrice: number | null;
      deductible: boolean;
    }[];
  }[];
};

// ─── Component ───────────────────────────────────────────────────────────────

export function PpeAdminOrderSheet({
  supervisors,
  products,
  onCreated,
}: PpeAdminOrderSheetProps) {
  const [selectedSupervisorId, setSelectedSupervisorId] = React.useState("");
  const [supervisorOpen, setSupervisorOpen] = React.useState(false);
  const [foremanCarts, setForemanCarts] = React.useState<ForemanCart[]>([]);
  const [activeForemanId, setActiveForemanId] = React.useState("");
  const [addForemanOpen, setAddForemanOpen] = React.useState(false);
  const [productSearch, setProductSearch] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [printing, setPrinting] = React.useState(false);
  const [lastOrder, setLastOrder] = React.useState<LastOrder | null>(null);

  const selectedSupervisor = React.useMemo(
    () => supervisors.find((s) => s.id === selectedSupervisorId) ?? null,
    [supervisors, selectedSupervisorId],
  );

  const availableForemenToAdd = React.useMemo(
    () =>
      (selectedSupervisor?.foremen ?? []).filter(
        (f) => !foremanCarts.some((fc) => fc.foremanId === f.id),
      ),
    [selectedSupervisor, foremanCarts],
  );

  const activeCart =
    foremanCarts.find((fc) => fc.foremanId === activeForemanId) ?? null;

  React.useEffect(() => {
    if (!activeForemanId && foremanCarts.length > 0) {
      setActiveForemanId(foremanCarts[0].foremanId);
    }
  }, [activeForemanId, foremanCarts]);

  const filteredProducts = React.useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)),
    );
  }, [productSearch, products]);

  function handleSelectSupervisor(id: string) {
    setSelectedSupervisorId(id);
    setForemanCarts([]);
    setActiveForemanId("");
    setSupervisorOpen(false);
  }

  function addForeman(foreman: { id: string; name: string }) {
    setForemanCarts((prev) => [
      ...prev,
      {
        foremanId: foreman.id,
        foremanName: foreman.name,
        siteId: "",
        siteName: "",
        siteCode: null,
        chargeToSite: false,
        items: [],
      },
    ]);
    setActiveForemanId(foreman.id);
    setAddForemanOpen(false);
  }

  function removeForeman(foremanId: string) {
    setForemanCarts((prev) => {
      const next = prev.filter((fc) => fc.foremanId !== foremanId);
      if (activeForemanId === foremanId)
        setActiveForemanId(next[0]?.foremanId ?? "");
      return next;
    });
  }

  function updateForemanSite(
    foremanId: string,
    site: { id: string; name: string; code: string | null } | null,
  ) {
    setForemanCarts((prev) =>
      prev.map((fc) =>
        fc.foremanId !== foremanId
          ? fc
          : {
              ...fc,
              siteId: site?.id ?? "",
              siteName: site?.name ?? "",
              siteCode: site?.code ?? null,
            },
      ),
    );
  }

  function updateCart(
    foremanId: string,
    updater: (items: PpeCartItem[]) => PpeCartItem[],
  ) {
    setForemanCarts((prev) =>
      prev.map((fc) =>
        fc.foremanId !== foremanId ? fc : { ...fc, items: updater(fc.items) },
      ),
    );
  }

  function addProductToCart(product: PpeProductDto) {
    if (!activeForemanId) {
      toast.info("Select a foreman tab first");
      return;
    }
    const rowId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    updateCart(activeForemanId, (items) => [
      ...items,
      {
        rowId,
        productId: product.id,
        productName: product.name,
        size: "",
        color: "",
        quantity: 1,
        unitPrice: product.unitPrice,
        isDeductible: product.isDeductible,
      },
    ]);
  }

  function updateRow(
    rowId: string,
    fields: Partial<
      Pick<PpeCartItem, "size" | "color" | "quantity" | "unitPrice">
    >,
  ) {
    if (!activeForemanId) return;
    updateCart(activeForemanId, (items) =>
      items.map((i) => (i.rowId !== rowId ? i : { ...i, ...fields })),
    );
  }

  function toggleForemanChargeToSite(foremanId: string) {
    setForemanCarts((prev) =>
      prev.map((fc) =>
        fc.foremanId !== foremanId
          ? fc
          : { ...fc, chargeToSite: !fc.chargeToSite },
      ),
    );
  }

  function removeRow(rowId: string) {
    if (!activeForemanId) return;
    updateCart(activeForemanId, (items) =>
      items.filter((i) => i.rowId !== rowId),
    );
  }

  const totalForemanItems = foremanCarts.reduce(
    (sum, fc) => sum + fc.items.length,
    0,
  );
  const totalCharged = foremanCarts
    .filter((fc) => fc.chargeToSite)
    .reduce(
      (sum, fc) =>
        sum +
        fc.items.reduce(
          (s, i) => s + (i.unitPrice != null ? i.unitPrice * i.quantity : 0),
          0,
        ),
      0,
    );
  const activeCartCharged = activeCart?.chargeToSite
    ? activeCart.items.reduce(
        (s, i) => s + (i.unitPrice != null ? i.unitPrice * i.quantity : 0),
        0,
      )
    : 0;
  const canSubmit =
    !!selectedSupervisorId &&
    foremanCarts.length > 0 &&
    foremanCarts.some((fc) => fc.items.length > 0);

  function makeOrderMeta() {
    const pad = (n: number) => String(n).padStart(2, "0");
    const now = new Date();
    const orderNumber = `PPE-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
    const issuedDate = now.toLocaleDateString("en-ZA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    return { orderNumber, issuedDate };
  }

  function buildVoucherData(
    orderNumber: string,
    issuedDate: string,
  ): LastOrder {
    return {
      orderNumber,
      issuedDate,
      supervisorName:
        selectedSupervisor?.name ?? selectedSupervisor?.email ?? "",
      foremen: foremanCarts
        .filter((fc) => fc.items.length > 0)
        .map((fc) => ({
          foremanName: fc.foremanName,
          siteName: fc.siteName || null,
          siteCode: fc.siteCode,
          chargeToSite: fc.chargeToSite ?? false,
          items: fc.items.map((i) => ({
            productName: i.productName,
            size: i.size || null,
            color: i.color || null,
            quantity: i.quantity,
            unitPrice: i.isDeductible ? i.unitPrice : null,
            deductible: i.isDeductible,
          })),
        })),
    };
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const results = await Promise.allSettled(
        foremanCarts
          .filter((fc) => fc.items.length > 0)
          .map((fc) =>
            fetch("/api/app/admin/ppe-orders", {
              method: "POST",
              credentials: "include",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                foremanId: fc.foremanId,
                siteId: fc.siteId || undefined,
                chargeToSite: fc.chargeToSite,
                items: fc.items.map((i) => ({
                  productId: i.productId,
                  quantity: i.quantity,
                  size: i.size || undefined,
                  color: i.color || undefined,
                  unitPriceAtOrder: i.unitPrice,
                })),
              }),
            }).then(async (res) => {
              const json = await res.json().catch(() => null);
              if (!res.ok)
                throw new Error(json?.error || `Failed for ${fc.foremanName}`);
              return json;
            }),
          ),
      );

      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length === 0) {
        const { orderNumber, issuedDate } = makeOrderMeta();
        setLastOrder(buildVoucherData(orderNumber, issuedDate));
        setForemanCarts([]);
        setActiveForemanId("");
        toast.success(
          `${foremanCarts.filter((fc) => fc.items.length > 0).length} PPE order(s) created`,
        );
        onCreated?.();
      } else if (failed.length < results.length) {
        toast.warning(
          `${results.length - failed.length} of ${results.length} orders created. Some failed.`,
        );
        onCreated?.();
      } else {
        toast.error("All orders failed. Please try again.");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create orders",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePrintVoucher() {
    let voucherData: LastOrder | null = null;
    if (canSubmit) {
      const { orderNumber, issuedDate } = makeOrderMeta();
      voucherData = buildVoucherData(orderNumber, issuedDate);
    } else {
      voucherData = lastOrder;
    }
    if (!voucherData) return;

    setPrinting(true);
    try {
      const res = await fetch("/api/app/admin/ppe-order/batch-pdf", {
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
      setPrinting(false);
    }
  }

  return (
    <div className="h-full bg-background">
      {/* Top header */}
      <div className="border-b border-border bg-primary text-primary-foreground px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-primary-foreground/60">
            Admin
          </span>
          <span className="text-primary-foreground/40">/</span>
          <span className="text-sm font-bold tracking-wide uppercase">
            PPE Order Creation
          </span>
        </div>
        {totalForemanItems > 0 && (
          <span className="text-[10px] tracking-widest text-primary-foreground/70 uppercase">
            {totalForemanItems} line{totalForemanItems !== 1 ? "s" : ""} across{" "}
            {foremanCarts.filter((fc) => fc.items.length > 0).length} foreman
            order
            {foremanCarts.filter((fc) => fc.items.length > 0).length !== 1
              ? "s"
              : ""}
          </span>
        )}
      </div>

      <div className="max-w-350 mx-auto p-6">
        <div className="border-b border-border pb-4 mb-6">
          <p className="text-[11px] tracking-[0.15em] text-muted-foreground uppercase mb-1">
            Create PPE orders for one or more foremen — one PDF document, one
            supervisor collects
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-0 border border-border rounded-md overflow-hidden">
          {/* LEFT PANEL */}
          <div className="border-r border-border flex flex-col">
            {/* Step 1 — Supervisor */}
            <div className="border-b border-border p-5 bg-card">
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  1
                </span>
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground">
                  Collecting Supervisor
                </span>
              </div>
              <Popover open={supervisorOpen} onOpenChange={setSupervisorOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={supervisorOpen}
                    className="w-full justify-between h-10 text-sm font-medium"
                  >
                    <span className="truncate">
                      {selectedSupervisor
                        ? (selectedSupervisor.name ?? selectedSupervisor.email)
                        : "Select supervisor…"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput
                      placeholder="Search supervisor…"
                      className="text-sm"
                    />
                    <CommandList>
                      <CommandEmpty>No supervisor found.</CommandEmpty>
                      <CommandGroup>
                        {supervisors.map((sv) => (
                          <CommandItem
                            key={sv.id}
                            value={sv.name ?? sv.email}
                            onSelect={() => handleSelectSupervisor(sv.id)}
                            className="text-sm"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedSupervisorId === sv.id
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                            <span className="flex-1">
                              {sv.name ?? sv.email}
                            </span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {sv.foremen.length} foreman
                              {sv.foremen.length !== 1 ? "en" : ""}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Step 2 — Foremen */}
            <div className="border-b border-border p-5 bg-card">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                      selectedSupervisorId
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    2
                  </span>
                  <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground">
                    Foremen
                  </span>
                  {foremanCarts.length > 0 && (
                    <span className="text-[10px] tabular-nums text-muted-foreground/60">
                      ({foremanCarts.length})
                    </span>
                  )}
                </div>
                {selectedSupervisorId && availableForemenToAdd.length > 0 && (
                  <Popover
                    open={addForemanOpen}
                    onOpenChange={setAddForemanOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                      >
                        <Plus className="h-3 w-3" /> Add Foreman
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-0" align="end">
                      <Command>
                        <CommandInput
                          placeholder="Search foreman…"
                          className="text-sm"
                        />
                        <CommandList>
                          <CommandEmpty>No more foremen to add.</CommandEmpty>
                          <CommandGroup>
                            {availableForemenToAdd.map((f) => (
                              <CommandItem
                                key={f.id}
                                value={f.name}
                                onSelect={() => addForeman(f)}
                                className="text-sm"
                              >
                                {f.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                )}
              </div>

              {foremanCarts.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  {selectedSupervisorId
                    ? 'Click "Add Foreman" to begin'
                    : "Select a supervisor first"}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {foremanCarts.map((fc) => (
                    <button
                      key={fc.foremanId}
                      onClick={() => setActiveForemanId(fc.foremanId)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-medium transition-all",
                        activeForemanId === fc.foremanId
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-foreground hover:border-primary/50",
                      )}
                    >
                      <span>{fc.foremanName}</span>
                      {fc.items.length > 0 && (
                        <span
                          className={cn(
                            "text-[10px] tabular-nums",
                            activeForemanId === fc.foremanId
                              ? "text-primary-foreground/70"
                              : "text-muted-foreground",
                          )}
                        >
                          {fc.items.length}
                        </span>
                      )}
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          removeForeman(fc.foremanId);
                        }}
                        className={cn(
                          "ml-0.5 rounded-sm hover:bg-black/20 p-0.5",
                          activeForemanId === fc.foremanId
                            ? "text-primary-foreground/70"
                            : "text-muted-foreground",
                        )}
                        role="button"
                        aria-label={`Remove ${fc.foremanName}`}
                      >
                        <X className="h-2.5 w-2.5" />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Step 3 — Site for active foreman (optional) */}
            {activeCart && (
              <div className="border-b border-border p-5 bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    3
                  </span>
                  <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground">
                    Site for {activeCart.foremanName}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60">
                    (optional)
                  </span>
                </div>
                <ForemanSiteSelect
                  sites={selectedSupervisor?.sites ?? []}
                  selectedSiteId={activeCart.siteId}
                  onSelect={(site) => updateForemanSite(activeForemanId, site)}
                />
              </div>
            )}

            {/* Cart header */}
            <div className="border-b border-border px-5 py-3 bg-muted/40 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground truncate">
                  {activeCart
                    ? `Items — ${activeCart.foremanName}`
                    : "PPE Items"}
                </span>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                {activeForemanId && (
                  <button
                    onClick={() => toggleForemanChargeToSite(activeForemanId)}
                    className={cn(
                      "flex items-center gap-1.5 text-[10px] font-bold tracking-[0.15em] uppercase px-2.5 py-1 rounded border transition-all",
                      activeCart?.chargeToSite
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:border-primary/40",
                    )}
                  >
                    <span
                      className={cn(
                        "w-2.5 h-2.5 rounded-sm border flex items-center justify-center",
                        activeCart?.chargeToSite
                          ? "bg-primary-foreground border-primary-foreground"
                          : "border-current",
                      )}
                    >
                      {activeCart?.chargeToSite && (
                        <span className="block w-1.5 h-1 border-b-2 border-l-2 border-primary -rotate-45 -translate-y-px" />
                      )}
                    </span>
                    Charge to Site
                    {activeCart?.chargeToSite && activeCartCharged > 0 && (
                      <span className="ml-0.5 opacity-80">
                        R{activeCartCharged.toFixed(2)}
                      </span>
                    )}
                  </button>
                )}
                <span className="text-[10px] text-muted-foreground tracking-widest uppercase">
                  {activeCart?.items.length ?? 0} line
                  {(activeCart?.items.length ?? 0) !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {/* Cart */}
            <div className="bg-card overflow-x-auto flex-1">
              {!activeForemanId ? (
                <div className="py-16 flex flex-col items-center gap-2 text-center">
                  <div className="w-8 h-8 border border-border rounded flex items-center justify-center text-muted-foreground/40 text-lg">
                    ∅
                  </div>
                  <p className="text-xs text-muted-foreground tracking-widest uppercase">
                    {foremanCarts.length > 0
                      ? "Select a foreman tab above"
                      : "Add a foreman to start"}
                  </p>
                </div>
              ) : !activeCart || activeCart.items.length === 0 ? (
                <div className="py-16 flex flex-col items-center gap-2 text-center">
                  <div className="w-8 h-8 border border-border rounded flex items-center justify-center text-muted-foreground/40 text-lg">
                    ∅
                  </div>
                  <p className="text-xs text-muted-foreground tracking-widest uppercase">
                    No items added
                  </p>
                  <p className="text-[11px] text-muted-foreground/60">
                    Click "Add" on a product from the right panel
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border hover:bg-transparent">
                      <TableHead className="text-[10px] font-bold tracking-[0.15em] uppercase py-2.5 pl-5">
                        Item
                      </TableHead>
                      <TableHead className="text-[10px] font-bold tracking-[0.15em] uppercase py-2.5 w-18">
                        Size
                      </TableHead>
                      <TableHead className="text-[10px] font-bold tracking-[0.15em] uppercase py-2.5 w-18">
                        Color
                      </TableHead>
                      <TableHead className="text-[10px] font-bold tracking-[0.15em] uppercase py-2.5 w-16 text-right">
                        Qty
                      </TableHead>
                      <TableHead className="text-[10px] font-bold tracking-[0.15em] uppercase py-2.5 w-22 text-right">
                        Unit Price
                      </TableHead>
                      <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeCart.items.map((item, idx) => (
                      <TableRow
                        key={item.rowId}
                        className={`border-b border-border ${idx % 2 === 0 ? "" : "bg-muted/20"}`}
                      >
                        <TableCell className="py-2.5 pl-5 text-sm font-medium text-foreground">
                          {item.productName}
                        </TableCell>
                        <TableCell className="py-2 pr-1">
                          <Input
                            value={item.size}
                            onChange={(e) =>
                              updateRow(item.rowId, { size: e.target.value })
                            }
                            placeholder="—"
                            className="h-7 text-xs px-2 w-16"
                          />
                        </TableCell>
                        <TableCell className="py-2 pr-1">
                          <Input
                            value={item.color}
                            onChange={(e) =>
                              updateRow(item.rowId, { color: e.target.value })
                            }
                            placeholder="—"
                            className="h-7 text-xs px-2 w-16"
                          />
                        </TableCell>
                        <TableCell className="py-2 pr-2">
                          <Input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => {
                              const n = Number(e.target.value);
                              if (Number.isFinite(n) && n > 0)
                                updateRow(item.rowId, {
                                  quantity: Math.floor(n),
                                });
                            }}
                            className="h-7 w-14 text-sm text-right tabular-nums px-2"
                          />
                        </TableCell>
                        <TableCell className="py-2 pr-2">
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={item.unitPrice ?? ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateRow(item.rowId, {
                                unitPrice:
                                  val === "" ? null : Math.max(0, Number(val)),
                              });
                            }}
                            placeholder="—"
                            className="h-7 w-20 text-sm text-right tabular-nums px-2"
                          />
                        </TableCell>
                        <TableCell className="py-2 pr-3 text-center">
                          <button
                            onClick={() => removeRow(item.rowId)}
                            className="text-muted-foreground/50 hover:text-destructive transition-colors text-lg leading-none font-light"
                            aria-label="Remove"
                          >
                            ×
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Submit bar */}
            <div className="border-t border-border p-4 bg-primary flex items-center justify-between gap-4">
              <div className="text-primary-foreground">
                {canSubmit ? (
                  <div>
                    <div className="text-[10px] tracking-widest text-primary-foreground/60 uppercase">
                      Creating
                    </div>
                    <div className="flex items-baseline gap-3">
                      <div className="text-sm font-bold">
                        {
                          foremanCarts.filter((fc) => fc.items.length > 0)
                            .length
                        }{" "}
                        order
                        {foremanCarts.filter((fc) => fc.items.length > 0)
                          .length !== 1
                          ? "s"
                          : ""}
                      </div>
                      {totalCharged > 0 && (
                        <div className="text-xs font-semibold tabular-nums text-primary-foreground/80">
                          R{totalCharged.toFixed(2)} charged
                        </div>
                      )}
                    </div>
                  </div>
                ) : lastOrder ? (
                  <div>
                    <div className="text-[10px] tracking-widest text-primary-foreground/60 uppercase">
                      Last Order
                    </div>
                    <div className="text-sm font-bold tabular-nums">
                      {lastOrder.orderNumber}
                    </div>
                  </div>
                ) : (
                  <span className="text-[11px] text-primary-foreground/50 tracking-wide">
                    No items added yet
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {(canSubmit || lastOrder) && (
                  <button
                    onClick={handlePrintVoucher}
                    disabled={printing}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold tracking-[0.15em] uppercase rounded border border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {printing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Printer className="h-3.5 w-3.5" />
                    )}
                    {printing ? "Generating…" : "Print Order"}
                  </button>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !canSubmit}
                  className={`px-6 py-2.5 text-xs font-bold tracking-[0.2em] uppercase rounded transition-all ${
                    submitting || !canSubmit
                      ? "bg-primary-foreground/20 text-primary-foreground/40 cursor-not-allowed"
                      : "bg-primary-foreground text-primary hover:bg-primary-foreground/90 active:scale-95"
                  }`}
                >
                  {submitting ? "Creating…" : "Create Orders →"}
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL — PPE Product Catalogue */}
          <div className="flex flex-col min-h-0">
            <div className="border-b border-border p-5 bg-muted/40 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground">
                  PPE Catalogue
                </span>
                <span className="text-[10px] tabular-nums text-muted-foreground/60">
                  ({filteredProducts.length})
                </span>
              </div>
              <div className="flex-1 sm:flex sm:justify-end">
                <Input
                  placeholder="Search products…"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="text-sm h-9 w-full sm:max-w-72"
                />
              </div>
            </div>

            <div
              className="overflow-auto flex-1 bg-card"
              style={{ maxHeight: "520px" }}
            >
              {filteredProducts.length === 0 ? (
                <div className="py-16 flex flex-col items-center gap-2">
                  <p className="text-xs text-muted-foreground tracking-widest uppercase">
                    No products found
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="sticky top-0 z-10">
                    <TableRow className="border-b border-border bg-muted/40 hover:bg-muted/40">
                      <TableHead className="text-[10px] font-bold tracking-[0.15em] uppercase py-2.5 pl-5">
                        Product
                      </TableHead>
                      <TableHead className="text-[10px] font-bold tracking-[0.15em] uppercase py-2.5 w-20 text-right">
                        Price
                      </TableHead>
                      <TableHead className="w-20 text-[10px] font-bold tracking-[0.15em] uppercase py-2.5 text-right pr-5">
                        Action
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((p, idx) => {
                      const inActiveCart = activeForemanId
                        ? (activeCart?.items.filter((i) => i.productId === p.id)
                            .length ?? 0)
                        : 0;
                      const inAnyCart = foremanCarts.some((fc) =>
                        fc.items.some((i) => i.productId === p.id),
                      );
                      return (
                        <TableRow
                          key={p.id}
                          className={`border-b border-border transition-colors group cursor-default ${
                            inActiveCart > 0
                              ? "bg-primary/5 hover:bg-primary/10"
                              : idx % 2 === 0
                                ? "hover:bg-muted/30"
                                : "bg-muted/20 hover:bg-muted/30"
                          }`}
                        >
                          <TableCell className="py-3 pl-5">
                            <div className="flex items-center gap-2">
                              {inAnyCart && (
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                              )}
                              <div>
                                <span className="text-sm font-medium">
                                  {p.name}
                                </span>
                                {p.sku && (
                                  <div className="text-xs text-muted-foreground">
                                    {p.sku}
                                  </div>
                                )}
                              </div>
                            </div>
                            {inActiveCart > 0 && (
                              <span className="text-[10px] text-primary tracking-wider mt-0.5 ml-3.5 block">
                                ×{inActiveCart} in this foreman
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="py-3 text-right text-sm text-muted-foreground">
                            {p.isDeductible && p.unitPrice
                              ? `R ${p.unitPrice.toFixed(2)}`
                              : "—"}
                          </TableCell>
                          <TableCell className="py-3 text-right pr-5">
                            <button
                              title={
                                activeCart
                                  ? `Add to ${activeCart.foremanName}`
                                  : "Select a foreman tab first"
                              }
                              onClick={() => addProductToCart(p)}
                              disabled={!activeForemanId}
                              className={`text-[10px] font-bold tracking-[0.15em] uppercase px-3 py-1.5 border rounded transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                                inActiveCart > 0
                                  ? "border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground hover:border-primary"
                                  : "border-border text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary"
                              }`}
                            >
                              {inActiveCart > 0 ? "+ Add" : "Add"}
                            </button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>

            <div className="border-t border-border px-5 py-3 bg-muted/40 flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="text-[10px] text-muted-foreground tracking-wider uppercase">
                  In this foreman
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 border border-border rounded-sm" />
                <span className="text-[10px] text-muted-foreground tracking-wider uppercase">
                  Available
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Foreman Site Selector ────────────────────────────────────────────────────

function ForemanSiteSelect({
  sites,
  selectedSiteId,
  onSelect,
}: {
  sites: { id: string; name: string; code: string | null }[];
  selectedSiteId: string;
  onSelect: (
    site: { id: string; name: string; code: string | null } | null,
  ) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = sites.find((s) => s.id === selectedSiteId) ?? null;

  if (sites.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground">
        No sites assigned to this supervisor
      </p>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="flex-1 justify-between h-9 text-sm font-normal"
          >
            <span className="truncate">
              {selected
                ? selected.code
                  ? `${selected.code} — ${selected.name}`
                  : selected.name
                : "No site (optional)"}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search site…" className="text-sm" />
            <CommandList>
              <CommandEmpty>No site found.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="__none__"
                  onSelect={() => {
                    onSelect(null);
                    setOpen(false);
                  }}
                  className="text-sm text-muted-foreground"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      !selectedSiteId ? "opacity-100" : "opacity-0",
                    )}
                  />
                  No site
                </CommandItem>
                {sites.map((s) => (
                  <CommandItem
                    key={s.id}
                    value={s.code ? `${s.code} ${s.name}` : s.name}
                    onSelect={() => {
                      onSelect(s);
                      setOpen(false);
                    }}
                    className="text-sm"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedSiteId === s.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="flex-1">{s.name}</span>
                    {s.code && (
                      <span className="text-xs text-muted-foreground ml-2">
                        {s.code}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected && (
        <button
          onClick={() => onSelect(null)}
          className="text-muted-foreground hover:text-foreground p-1"
          aria-label="Clear site"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
