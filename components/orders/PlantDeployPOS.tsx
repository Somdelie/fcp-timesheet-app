"use client";

import * as React from "react";
import { toast } from "react-toastify";
import {
  Check,
  ChevronsUpDown,
  Loader2,
  Minus,
  Plus,
  Printer,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export interface PlantSiteDto {
  id: string;
  name: string;
  code?: string | null;
}

export interface PlantSupervisorDto {
  id: string;
  name: string | null;
  email: string;
  sites: PlantSiteDto[];
}

export interface PlantItemDto {
  id: string;
  name: string;
  sku: string | null;
  thumbnailUrl: string | null;
  sizes: string[];
}

interface PlantDeployPOSProps {
  supervisors: PlantSupervisorDto[];
  items: PlantItemDto[];
  allSites?: PlantSiteDto[];
  onDeployed?: () => void;
}

type CartItem = {
  productId: string;
  productName: string;
  size: string | null;
  sizes: string[];
  quantity: number;
  note: string;
  unitPrice: number | null;
};

type SiteCart = {
  siteId: string;
  siteName: string;
  siteCode?: string | null;
  chargeToSite: boolean;
  items: CartItem[];
};

type LastOrder = {
  orderNumber: string;
  issuedDate: string;
  supervisorName: string;
  sites: {
    siteName: string;
    siteCode?: string | null;
    items: { productName: string; quantity: number; note?: string }[];
  }[];
};

export default function PlantDeployPOS({
  supervisors,
  items,
  allSites,
  onDeployed,
}: PlantDeployPOSProps) {
  const [selectedSupervisorId, setSelectedSupervisorId] =
    React.useState<string>("");
  const [supervisorOpen, setSupervisorOpen] = React.useState(false);
  const [sitesCarts, setSitesCarts] = React.useState<SiteCart[]>([]);
  const [activeSiteId, setActiveSiteId] = React.useState<string>("");
  const [addSiteOpen, setAddSiteOpen] = React.useState(false);
  const [productSearch, setProductSearch] = React.useState("");
  const [reference, setReference] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [printing, setPrinting] = React.useState(false);
  const [lastOrder, setLastOrder] = React.useState<LastOrder | null>(null);

  const selectedSupervisor = React.useMemo(
    () => supervisors.find((s) => s.id === selectedSupervisorId) ?? null,
    [supervisors, selectedSupervisorId],
  );

  const availableSitesToAdd = React.useMemo(() => {
    const supervisorSites = selectedSupervisor?.sites ?? [];
    const sourceSites =
      supervisorSites.length > 0 ? supervisorSites : (allSites ?? []);
    return sourceSites.filter(
      (s) => !sitesCarts.some((sc) => sc.siteId === s.id),
    );
  }, [selectedSupervisor, sitesCarts, allSites]);

  const activeSiteCart =
    sitesCarts.find((sc) => sc.siteId === activeSiteId) ?? null;
  const activeCart = activeSiteCart?.items ?? [];

  function handleSelectSupervisor(id: string) {
    setSelectedSupervisorId(id);
    setSitesCarts([]);
    setActiveSiteId("");
    setSupervisorOpen(false);
  }

  function addSite(site: PlantSiteDto) {
    setSitesCarts((prev) => [
      ...prev,
      {
        siteId: site.id,
        siteName: site.name,
        siteCode: site.code,
        chargeToSite: false,
        items: [],
      },
    ]);
    setActiveSiteId(site.id);
    setAddSiteOpen(false);
  }

  function removeSite(siteId: string) {
    setSitesCarts((prev) => {
      const next = prev.filter((sc) => sc.siteId !== siteId);
      if (activeSiteId === siteId) setActiveSiteId(next[0]?.siteId ?? "");
      return next;
    });
  }

  const filteredItems = React.useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.sizes ?? []).some((s) => s.toLowerCase().includes(q)),
    );
  }, [productSearch, items]);

  function updateSiteCart(
    siteId: string,
    updater: (items: CartItem[]) => CartItem[],
  ) {
    setSitesCarts((prev) =>
      prev.map((sc) =>
        sc.siteId !== siteId ? sc : { ...sc, items: updater(sc.items) },
      ),
    );
  }

  function addToCart(item: PlantItemDto) {
    if (!activeSiteId) {
      toast.info("Add a site first");
      return;
    }
    updateSiteCart(activeSiteId, (prev) => {
      const existing = prev.find((i) => i.productId === item.id);
      if (existing)
        return prev.map((i) =>
          i.productId === item.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      return [
        ...prev,
        {
          productId: item.id,
          productName: item.name,
          size: null,
          sizes: item.sizes ?? [],
          quantity: 1,
          note: "",
          unitPrice: null,
        },
      ];
    });
  }

  function updateQuantity(productId: string, quantity: number) {
    updateSiteCart(activeSiteId, (prev) =>
      prev
        .map((i) => (i.productId === productId ? { ...i, quantity } : i))
        .filter((i) => i.quantity > 0),
    );
  }

  function updateNote(productId: string, note: string) {
    updateSiteCart(activeSiteId, (prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, note } : i)),
    );
  }

  function removeFromCart(productId: string) {
    updateSiteCart(activeSiteId, (prev) =>
      prev.filter((i) => i.productId !== productId),
    );
  }

  function updateUnitPrice(productId: string, unitPrice: number | null) {
    updateSiteCart(activeSiteId, (prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, unitPrice } : i)),
    );
  }

  function toggleChargeToSite(siteId: string) {
    setSitesCarts((prev) =>
      prev.map((sc) =>
        sc.siteId !== siteId ? sc : { ...sc, chargeToSite: !sc.chargeToSite },
      ),
    );
  }

  const totalUnits = sitesCarts.reduce(
    (sum, sc) => sum + sc.items.reduce((s, i) => s + i.quantity, 0),
    0,
  );
  const totalCharged = sitesCarts
    .filter((sc) => sc.chargeToSite)
    .reduce(
      (sum, sc) =>
        sum +
        sc.items.reduce(
          (s, i) => s + (i.unitPrice != null ? i.unitPrice * i.quantity : 0),
          0,
        ),
      0,
    );
  const activeCartCharged = activeSiteCart?.chargeToSite
    ? activeCart.reduce(
        (s, i) => s + (i.unitPrice != null ? i.unitPrice * i.quantity : 0),
        0,
      )
    : 0;
  const canDeploy =
    !!selectedSupervisorId && sitesCarts.length > 0 && totalUnits > 0;

  function buildVoucherData(
    orderNumber: string,
    issuedDate: string,
  ): LastOrder {
    return {
      orderNumber,
      issuedDate,
      supervisorName:
        selectedSupervisor?.name ?? selectedSupervisor?.email ?? "",
      sites: sitesCarts
        .filter((sc) => sc.items.length > 0)
        .map((sc) => ({
          siteName: sc.siteName,
          siteCode: sc.siteCode,
          items: sc.items.map((i) => ({
            productName: i.productName,
            quantity: i.quantity,
            note: i.note.trim() || undefined,
          })),
        })),
    };
  }

  function makeOrderMeta() {
    const pad = (n: number) => String(n).padStart(2, "0");
    const now = new Date();
    const orderNumber =
      reference.trim() ||
      `PO-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const issuedDate = now.toLocaleDateString("en-ZA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    return { orderNumber, issuedDate };
  }

  async function handleDeploy() {
    if (!selectedSupervisorId) {
      toast.error("Please select a supervisor");
      return;
    }
    if (sitesCarts.length === 0) {
      toast.error("Add at least one site");
      return;
    }
    if (totalUnits === 0) {
      toast.error("Add at least one item to deploy");
      return;
    }

    try {
      setSubmitting(true);
      const allRequests = sitesCarts.flatMap((siteCart) =>
        siteCart.items.map((item) =>
          fetch("/api/app/admin/plant-assignments", {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              reference: reference.trim() || undefined,
              supervisorName:
                selectedSupervisor?.name ?? selectedSupervisor?.email ?? null,
              siteId: siteCart.siteId,
              productId: item.productId,
              size: item.size || undefined,
              quantity: item.quantity,
              note: item.note.trim() || undefined,
              unitPrice: item.unitPrice,
              chargeToSite: siteCart.chargeToSite,
            }),
          }).then(async (res) => {
            const json = await res.json().catch(() => null);
            if (res.status === 409)
              throw new Error(
                `Deployment "${reference.trim()}" already exists`,
              );
            if (!res.ok)
              throw new Error(
                json?.error || `Failed to deploy ${item.productName}`,
              );
            return json;
          }),
        ),
      );

      const results = await Promise.allSettled(allRequests);
      const failed = results.filter((r) => r.status === "rejected");

      if (failed.length === 0) {
        const sitesLabel =
          sitesCarts.length === 1
            ? sitesCarts[0].siteName
            : `${sitesCarts.length} sites`;
        toast.success(
          `${totalUnits} unit${totalUnits !== 1 ? "s" : ""} deployed to ${sitesLabel}`,
        );
        const { orderNumber, issuedDate } = makeOrderMeta();
        setLastOrder(buildVoucherData(orderNumber, issuedDate));
        setSitesCarts([]);
        setActiveSiteId("");
        setReference("");
        onDeployed?.();
      } else if (failed.length < allRequests.length) {
        toast.warning(
          `${allRequests.length - failed.length} of ${allRequests.length} items deployed. Some failed.`,
        );
        onDeployed?.();
      } else {
        toast.error("All deployments failed. Please try again.");
      }
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Failed to deploy items",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePrintVoucher() {
    let voucherData: LastOrder | null = null;
    if (canDeploy) {
      const { orderNumber, issuedDate } = makeOrderMeta();
      voucherData = buildVoucherData(orderNumber, issuedDate);
    } else {
      voucherData = lastOrder;
    }
    if (!voucherData) return;

    setPrinting(true);
    try {
      const res = await fetch("/api/app/admin/plant-voucher/pdf", {
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

  const sitesWithItems = sitesCarts.filter((sc) => sc.items.length > 0).length;

  return (
    <div className="h-full bg-background">
      {/* Top header bar */}
      <div className="border-b border-border bg-primary text-primary-foreground px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-primary-foreground/60">
            Admin
          </span>
          <span className="text-primary-foreground/40">/</span>
          <span className="text-sm font-bold tracking-wide uppercase">
            Plant Deployment Entry
          </span>
        </div>
        {totalUnits > 0 && (
          <span className="text-[10px] tracking-widest text-primary-foreground/70 uppercase">
            {totalUnits} unit{totalUnits !== 1 ? "s" : ""} across{" "}
            {sitesWithItems} site
            {sitesWithItems !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="max-w-full mx-auto p-6">
        {/* Page title block */}
        <div className="border-b border-border pb-0 mb-4">
          <p className="text-[11px] tracking-[0.15em] text-muted-foreground uppercase mb-1">
            Deploy plant &amp; equipment to one or more sites — creates tracked
            assignments with full transfer history
          </p>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-border rounded overflow-hidden">
          {/* LEFT PANEL */}
          <div className="border-r border-border flex flex-col col-span-2 h-full md:max-h-[calc(100vh-15rem)]">
            <div className="grid grid-cols-1 md:grid-cols-2">
              {/* Order Number */}
              <div className="border-b border-border p-5 bg-card">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground">
                    Order Number
                  </span>
                </div>
                <Input
                  placeholder="e.g. 68090 (BuildSmart PO #)"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="h-10 text-sm font-medium"
                />
              </div>

              {/* Step 1 — Supervisor selector */}
              <div className="border-b border-border p-5 bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    1
                  </span>
                  <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground">
                    Select Supervisor
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
                          ? (selectedSupervisor.name ??
                            selectedSupervisor.email)
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
                                {sv?.sites?.length} site
                                {sv?.sites?.length !== 1 ? "s" : ""}
                              </span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Step 2 — Sites */}
            <div className="border-b border-border p-5 bg-card">
              <div className="flex items-center justify-between mb-1">
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
                    Sites
                  </span>
                  {sitesCarts.length > 0 && (
                    <span className="text-[10px] tabular-nums text-muted-foreground/60">
                      ({sitesCarts.length})
                    </span>
                  )}
                </div>

                {selectedSupervisorId && availableSitesToAdd.length > 0 && (
                  <Popover open={addSiteOpen} onOpenChange={setAddSiteOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                      >
                        <Plus className="h-3 w-3" /> Add Site
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-0" align="end">
                      <Command>
                        <CommandInput
                          placeholder="Search site…"
                          className="text-sm"
                        />
                        <CommandList>
                          <CommandEmpty>No more sites to add.</CommandEmpty>
                          <CommandGroup>
                            {availableSitesToAdd.map((s) => (
                              <CommandItem
                                key={s.id}
                                value={s.name}
                                onSelect={() => addSite(s)}
                                className="text-sm"
                              >
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
                )}
              </div>

              {sitesCarts.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  {selectedSupervisorId
                    ? 'Click "Add Site" to begin'
                    : "Select a supervisor first"}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {sitesCarts.map((sc) => {
                    const siteUnits = sc.items.reduce(
                      (s, i) => s + i.quantity,
                      0,
                    );
                    return (
                      <button
                        key={sc.siteId}
                        onClick={() => setActiveSiteId(sc.siteId)}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-medium transition-all",
                          activeSiteId === sc.siteId
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border text-foreground hover:border-primary/50",
                        )}
                      >
                        <span>
                          {sc.siteName}
                          {sc.siteCode ? ` (${sc.siteCode})` : ""}
                        </span>
                        {siteUnits > 0 && (
                          <span
                            className={cn(
                              "text-[10px] tabular-nums",
                              activeSiteId === sc.siteId
                                ? "text-primary-foreground/70"
                                : "text-muted-foreground",
                            )}
                          >
                            {siteUnits}u
                          </span>
                        )}
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSite(sc.siteId);
                          }}
                          className={cn(
                            "ml-0.5 rounded-sm hover:bg-black/20 p-0.5",
                            activeSiteId === sc.siteId
                              ? "text-primary-foreground/70"
                              : "text-muted-foreground",
                          )}
                          role="button"
                          aria-label={`Remove ${sc.siteName}`}
                        >
                          <X className="h-2.5 w-2.5" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Cart section header */}
            <div className="border-b border-border px-5 py-2 bg-muted/40 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground truncate">
                  {activeSiteCart
                    ? `Items — ${activeSiteCart.siteName}`
                    : "Deployment Items"}
                </span>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                {activeSiteId && (
                  <button
                    onClick={() => toggleChargeToSite(activeSiteId)}
                    className={cn(
                      "flex items-center gap-1.5 text-[10px] font-bold tracking-[0.15em] uppercase px-2.5 py-1 rounded border transition-all",
                      activeSiteCart?.chargeToSite
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:border-primary/40",
                    )}
                  >
                    <span
                      className={cn(
                        "w-2.5 h-2.5 rounded-sm border flex items-center justify-center",
                        activeSiteCart?.chargeToSite
                          ? "bg-primary-foreground border-primary-foreground"
                          : "border-current",
                      )}
                    >
                      {activeSiteCart?.chargeToSite && (
                        <span className="block w-1.5 h-1 border-b-2 border-l-2 border-primary -rotate-45 -translate-y-px" />
                      )}
                    </span>
                    Charge to Site
                    {activeSiteCart?.chargeToSite && activeCartCharged > 0 && (
                      <span className="ml-0.5 opacity-80">
                        R{activeCartCharged.toFixed(2)}
                      </span>
                    )}
                  </button>
                )}
                <div className="flex items-baseline gap-1">
                  <span className="text-[10px] text-muted-foreground tracking-widest uppercase">
                    Units
                  </span>
                  <span className="text-base font-bold tabular-nums text-foreground">
                    {totalUnits}
                  </span>
                </div>
              </div>
            </div>

            {/* Cart table */}
            <div className="bg-card overflow-x-auto flex-1">
              {!activeSiteId ? (
                <div className="py-16 flex flex-col items-center gap-2 text-center">
                  <div className="w-8 h-8 border border-border rounded flex items-center justify-center text-muted-foreground/40 text-lg">
                    ∅
                  </div>
                  <p className="text-xs text-muted-foreground tracking-widest uppercase">
                    {sitesCarts.length > 0
                      ? "Select a site tab above"
                      : "Add a site to start deploying"}
                  </p>
                </div>
              ) : activeCart.length === 0 ? (
                <div className="py-16 flex flex-col items-center gap-2 text-center">
                  <div className="w-8 h-8 border border-border rounded flex items-center justify-center text-muted-foreground/40 text-lg">
                    ∅
                  </div>
                  <p className="text-xs text-muted-foreground tracking-widest uppercase">
                    No items added
                  </p>
                  <p className="text-[11px] text-muted-foreground/60">
                    Click "Add" on an item from the right panel
                  </p>
                </div>
              ) : (
                <Table className="border-r">
                  <TableHeader>
                    <TableRow className="border-b border-border hover:bg-transparent">
                      <TableHead className="text-[10px] font-bold tracking-[0.15em] uppercase py-2.5 pl-5 w-48 text-left">
                        Item
                      </TableHead>
                      <TableHead className="text-[10px] font-bold tracking-[0.15em] uppercase py-2.5 w-34 text-left">
                        Size
                      </TableHead>
                      <TableHead className="text-[10px] font-bold tracking-[0.15em] uppercase py-2.5 w-34 text-left">
                        Quantity
                      </TableHead>
                      <TableHead className="text-[10px] font-bold tracking-[0.15em] uppercase py-2.5 w-34 text-left">
                        Unit Price
                      </TableHead>
                      <TableHead className="text-[10px] font-bold tracking-[0.15em] uppercase py-2.5 w-10 text-center">
                        Actions
                      </TableHead>

                      {/* <TableHead className="w-10" /> */}
                    </TableRow>
                  </TableHeader>
                  <TableBody className="[&_tr:last-child]:border-b [&_tr:last-child]:border-border">
                    {activeCart.map((item, idx) => {
                      const hasSizes = item.sizes.length > 0;
                      return (
                        <TableRow
                          key={item.productId}
                          className={`border-b border-border transition-colors ${
                            idx % 2 === 0 ? "" : "bg-muted/20"
                          }`}
                        >
                          <TableCell className="py-1 pl-5 text-sm font-medium text-foreground w-68 truncate max-w-68">
                            {item.productName}
                          </TableCell>
                          <TableCell className="py-1 pr-2">
                            {hasSizes ? (
                              <div className="flex flex-wrap gap-0.5">
                                {item.sizes.map((s) => (
                                  <button
                                    key={s}
                                    onClick={() => {
                                      updateSiteCart(activeSiteId, (prev) =>
                                        prev.map((i) =>
                                          i.productId === item.productId
                                            ? {
                                                ...i,
                                                size: i.size === s ? null : s,
                                              }
                                            : i,
                                        ),
                                      );
                                    }}
                                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded border transition-all ${
                                      item.size === s
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border-border text-muted-foreground hover:border-primary/50"
                                    }`}
                                  >
                                    {s}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="py-1 pr-2">
                            <div className="inline-flex items-center rounded-md border border-border/70 overflow-hidden">
                              <button
                                type="button"
                                onClick={() =>
                                  updateQuantity(
                                    item.productId,
                                    Math.max(1, item.quantity - 1),
                                  )
                                }
                                disabled={item.quantity <= 1}
                                className="h-7 w-7 bg-primary flex items-center justify-center text-white hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                                aria-label="Decrease quantity"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={item.quantity}
                                onChange={(e) => {
                                  const n = Number(
                                    e.target.value.replace(/\D/g, ""),
                                  );
                                  if (!Number.isFinite(n)) return;
                                  updateQuantity(
                                    item.productId,
                                    Math.max(1, n),
                                  );
                                }}
                                className="h-7 w-8 text-center text-sm tabular-nums bg-transparent outline-none"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  updateQuantity(
                                    item.productId,
                                    item.quantity + 1,
                                  )
                                }
                                className="h-7 w-7 bg-primary flex items-center justify-center text-white hover:bg-muted hover:text-foreground transition-colors"
                                aria-label="Increase quantity"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          </TableCell>
                          <TableCell className="py-1 pr-2">
                            <div className="inline-flex items-center gap-1 h-7 px-2 rounded bg-muted/40 border focus-within:border-primary/50 focus-within:bg-card transition-colors">
                              <span className="text-xs text-muted-foreground font-bold">
                                R
                              </span>
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={item.unitPrice ?? ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  updateUnitPrice(
                                    item.productId,
                                    val === ""
                                      ? null
                                      : Math.max(0, Number(val)),
                                  );
                                }}
                                placeholder="0.00"
                                className="w-full text-sm text-right tabular-nums bg-transparent outline-none placeholder:text-muted-foreground/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </div>
                          </TableCell>
                          {/* <TableCell className="py-2">
                            <Input
                              value={item.note}
                              onChange={(e) =>
                                updateNote(item.productId, e.target.value)
                              }
                              placeholder="Note…"
                              className="h-7 text-xs px-2"
                            />
                          </TableCell> */}
                          <TableCell className="py-1 pr-3 text-center">
                            <button
                              onClick={() => removeFromCart(item.productId)}
                              className="text-muted-foreground/50 hover:text-destructive transition-colors text-xl leading-none font-light cursor-pointer"
                              aria-label="Remove item"
                            >
                              <X className="h-6 w-6" />
                            </button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Submit bar */}
            <div className="border-t border-border px-4 py-1 bg-primary flex items-center justify-between gap-4">
              <div className="text-primary-foreground">
                {totalUnits > 0 ? (
                  <div>
                    <div className="text-[10px] tracking-widest text-primary-foreground/60 uppercase">
                      Deploying
                    </div>
                    <div className="flex items-baseline gap-3">
                      <div className="text-xl font-bold tabular-nums">
                        {totalUnits} unit{totalUnits !== 1 ? "s" : ""}
                      </div>
                      {totalCharged > 0 && (
                        <div className="text-sm font-semibold tabular-nums text-primary-foreground/80">
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
                    No items selected
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {(canDeploy || lastOrder) && (
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
                  onClick={handleDeploy}
                  disabled={submitting || !canDeploy}
                  className={`px-6 py-2.5 text-xs font-bold tracking-[0.2em] uppercase rounded transition-all ${
                    submitting || !canDeploy
                      ? "bg-primary-foreground/20 text-primary-foreground/40 cursor-not-allowed"
                      : "bg-primary-foreground text-primary hover:bg-primary-foreground/90 active:scale-95"
                  }`}
                >
                  {submitting
                    ? "Deploying…"
                    : `Deploy${sitesCarts.length > 1 ? ` (${sitesCarts.length} Sites)` : ""} →`}
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL — Plant Item Picker */}
          <div className="flex flex-col min-h-0 max-h-560 md:max-h-[calc(100vh-15rem)]">
            {/* Picker header */}
            <div className="border-b border-border p-5 bg-muted/40 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground">
                  Plant Catalogue
                </span>
                <span className="text-[10px] tabular-nums text-muted-foreground/60">
                  ({filteredItems.length})
                </span>
              </div>
              <div className="flex-1 sm:flex sm:justify-end">
                <Input
                  placeholder="Search items, SKU, size…"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="text-sm h-9 w-full sm:max-w-72"
                />
              </div>
            </div>

            {/* Item table */}
            <div
              className="overflow-auto flex-1 bg-card"
              style={{ maxHeight: "520px" }}
            >
              {filteredItems.length === 0 ? (
                <div className="py-16 flex flex-col items-center gap-2">
                  <p className="text-xs text-muted-foreground tracking-widests uppercase">
                    No items found
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="sticky top-0 z-10">
                    <TableRow className="border-b border-border bg-muted/40 hover:bg-muted/40">
                      <TableHead className="text-[10px] font-bold tracking-[0.15em] uppercase py-2.5 pl-5">
                        Item Name
                      </TableHead>
                      <TableHead className="text-[10px] font-bold tracking-[0.15em] uppercase py-2.5">
                        Sizes
                      </TableHead>
                      <TableHead className="w-24 text-[10px] font-bold tracking-[0.15em] uppercase py-2.5 text-right pr-5">
                        Action
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((p, idx) => {
                      const inActiveCart = activeSiteId
                        ? activeCart.find((c) => c.productId === p.id)
                        : null;
                      const inAnyCart = sitesCarts.some((sc) =>
                        sc.items.some((i) => i.productId === p.id),
                      );
                      return (
                        <TableRow
                          key={p.id}
                          className={`border-b border-border transition-colors group cursor-default ${
                            inActiveCart
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
                                <span className="text-sm font-medium text-foreground">
                                  {p.name}
                                </span>
                                {p.sku && (
                                  <div className="text-xs text-muted-foreground">
                                    {p.sku}
                                  </div>
                                )}
                              </div>
                            </div>
                            {inActiveCart && (
                              <span className="text-[10px] text-primary tracking-wider mt-0.5 ml-3.5 block">
                                ×{inActiveCart.quantity} in this site
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="py-3">
                            {(p.sizes ?? []).length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {(p.sizes ?? []).map((s) => (
                                  <span
                                    key={s}
                                    className="rounded border border-border bg-muted/60 px-1.5 py-0.5 text-xs font-medium"
                                  >
                                    {s}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="py-3 text-right pr-5">
                            <button
                              onClick={() => addToCart(p)}
                              disabled={!activeSiteId}
                              className={`text-[10px] font-bold tracking-[0.15em] uppercase px-3 py-1.5 border rounded transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                                inActiveCart
                                  ? "border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground hover:border-primary"
                                  : "border-border text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary"
                              }`}
                            >
                              {inActiveCart ? "+ Add" : "Add"}
                            </button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Bottom legend */}
            <div className="border-t border-border px-5 py-3 bg-muted/40 flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="text-[10px] text-muted-foreground tracking-wider uppercase">
                  In deployment
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
