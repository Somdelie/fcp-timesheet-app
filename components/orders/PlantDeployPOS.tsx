"use client";

import * as React from "react";
import { toast } from "react-toastify";

import { Check, ChevronsUpDown } from "lucide-react";

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
  onDeployed?: () => void;
}

type CartItem = {
  productId: string;
  productName: string;
  quantity: number;
  note: string;
};

export default function PlantDeployPOS({
  supervisors,
  items,
  onDeployed,
}: PlantDeployPOSProps) {
  const [selectedSupervisorId, setSelectedSupervisorId] =
    React.useState<string>("");
  const [supervisorOpen, setSupervisorOpen] = React.useState(false);

  const [selectedSiteId, setSelectedSiteId] = React.useState<string>("");
  const [siteOpen, setSiteOpen] = React.useState(false);

  const [productSearch, setProductSearch] = React.useState("");
  const [cart, setCart] = React.useState<CartItem[]>([]);
  const [submitting, setSubmitting] = React.useState(false);

  const selectedSupervisor = React.useMemo(
    () => supervisors.find((s) => s.id === selectedSupervisorId) ?? null,
    [supervisors, selectedSupervisorId],
  );

  const availableSites: PlantSiteDto[] = selectedSupervisor?.sites ?? [];

  const selectedSite = React.useMemo(
    () => availableSites.find((s) => s.id === selectedSiteId) ?? null,
    [availableSites, selectedSiteId],
  );

  function handleSelectSupervisor(id: string) {
    setSelectedSupervisorId(id);
    setSelectedSiteId("");
    setSupervisorOpen(false);
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

  function addToCart(item: PlantItemDto) {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === item.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === item.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [
        ...prev,
        { productId: item.id, productName: item.name, quantity: 1, note: "" },
      ];
    });
  }

  function updateQuantity(productId: string, quantity: number) {
    setCart((prev) =>
      prev
        .map((item) =>
          item.productId === productId ? { ...item, quantity } : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  function updateNote(productId: string, note: string) {
    setCart((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, note } : item,
      ),
    );
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  }

  async function handleDeploy() {
    if (!selectedSupervisorId) {
      toast.error("Please select a supervisor");
      return;
    }
    if (!selectedSiteId) {
      toast.error("Please select a site");
      return;
    }
    if (cart.length === 0) {
      toast.error("Add at least one item to deploy");
      return;
    }

    try {
      setSubmitting(true);
      const results = await Promise.allSettled(
        cart.map((item) =>
          fetch("/api/app/admin/plant-assignments", {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              siteId: selectedSiteId,
              productId: item.productId,
              quantity: item.quantity,
              note: item.note.trim() || undefined,
            }),
          }).then(async (res) => {
            const json = await res.json().catch(() => null);
            if (!res.ok)
              throw new Error(
                json?.error || `Failed to deploy ${item.productName}`,
              );
            return json;
          }),
        ),
      );

      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length === 0) {
        toast.success(
          `${cart.length} item${cart.length !== 1 ? "s" : ""} deployed to ${selectedSite?.name}`,
        );
        setCart([]);
        onDeployed?.();
      } else if (failed.length < cart.length) {
        toast.warning(
          `${cart.length - failed.length} of ${cart.length} items deployed. Some failed.`,
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

  const totalUnits = cart.reduce((s, i) => s + i.quantity, 0);
  const canDeploy = !!selectedSupervisorId && !!selectedSiteId && cart.length > 0;

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
        {cart.length > 0 && (
          <span className="text-[10px] tracking-widest text-primary-foreground/70 uppercase">
            {cart.length} item{cart.length !== 1 ? "s" : ""} to deploy
          </span>
        )}
      </div>

      <div className="max-w-350 mx-auto p-6">
        {/* Page title block */}
        <div className="border-b border-border pb-4 mb-6">
          <p className="text-[11px] tracking-[0.15em] text-muted-foreground uppercase mb-1">
            Deploy plant &amp; equipment to a site — creates tracked assignments
            with full transfer history
          </p>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-0 border border-border rounded-md overflow-hidden">
          {/* LEFT PANEL */}
          <div className="border-r border-border">
            {/* Step 1 — Supervisor selector */}
            <div className="border-b border-border p-5 bg-card">
              <div className="flex items-center gap-2 mb-3">
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
                              {sv.sites.length} site
                              {sv.sites.length !== 1 ? "s" : ""}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Step 2 — Site selector */}
            <div className="border-b border-border p-5 bg-card">
              <div className="flex items-center gap-2 mb-3">
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
                  Select Site
                </span>
              </div>
              <Popover
                open={siteOpen}
                onOpenChange={(o) => {
                  if (!selectedSupervisorId) {
                    toast.info("Select a supervisor first");
                    return;
                  }
                  setSiteOpen(o);
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={siteOpen}
                    disabled={!selectedSupervisorId}
                    className="w-full justify-between h-10 text-sm font-medium"
                  >
                    <span className="truncate">
                      {selectedSite
                        ? selectedSite.name
                        : selectedSupervisorId
                          ? availableSites.length === 0
                            ? "No sites assigned to this supervisor"
                            : "Select site…"
                          : "Select a supervisor first"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput
                      placeholder="Search site…"
                      className="text-sm"
                    />
                    <CommandList>
                      <CommandEmpty>No site found.</CommandEmpty>
                      <CommandGroup>
                        {availableSites.map((s) => (
                          <CommandItem
                            key={s.id}
                            value={s.name}
                            onSelect={() => {
                              setSelectedSiteId(s.id);
                              setSiteOpen(false);
                            }}
                            className="text-sm"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedSiteId === s.id
                                  ? "opacity-100"
                                  : "opacity-0",
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

              {selectedSite && (
                <div className="mt-2.5 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <p className="text-[11px] text-muted-foreground tracking-wide">
                    Deploying to{" "}
                    <span className="font-bold text-foreground">
                      {selectedSite.name}
                      {selectedSite.code && (
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          ({selectedSite.code})
                        </span>
                      )}
                    </span>
                  </p>
                </div>
              )}
            </div>

            {/* Deployment items section header */}
            <div className="border-b border-border px-5 py-3 bg-muted/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground">
                  Deployment Items
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-[10px] text-muted-foreground tracking-widest uppercase">
                  Units
                </span>
                <span className="text-base font-bold tabular-nums text-foreground">
                  {totalUnits}
                </span>
              </div>
            </div>

            {/* Cart table */}
            <div className="bg-card overflow-x-auto">
              {cart.length === 0 ? (
                <div className="py-16 flex flex-col items-center gap-2 text-center">
                  <div className="w-8 h-8 border border-border rounded flex items-center justify-center text-muted-foreground/40 text-lg">
                    ∅
                  </div>
                  <p className="text-xs text-muted-foreground tracking-widest uppercase">
                    No items added yet
                  </p>
                  <p className="text-[11px] text-muted-foreground/60">
                    Click "Add" on an item from the right panel
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border hover:bg-transparent">
                      <TableHead className="text-[10px] font-bold tracking-[0.15em] uppercase py-2.5 pl-5">
                        Item
                      </TableHead>
                      <TableHead className="text-[10px] font-bold tracking-[0.15em] uppercase py-2.5 w-20 text-right">
                        Qty
                      </TableHead>
                      <TableHead className="text-[10px] font-bold tracking-[0.15em] uppercase py-2.5 w-36">
                        Note
                      </TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cart.map((item, idx) => (
                      <TableRow
                        key={item.productId}
                        className={`border-b border-border transition-colors ${
                          idx % 2 === 0 ? "" : "bg-muted/20"
                        }`}
                      >
                        <TableCell className="py-2.5 pl-5 text-sm font-medium text-foreground">
                          {item.productName}
                        </TableCell>
                        <TableCell className="py-2 pr-2">
                          <Input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => {
                              const n = Number(e.target.value);
                              if (!Number.isFinite(n)) return;
                              updateQuantity(
                                item.productId,
                                Math.max(1, Math.floor(n)),
                              );
                            }}
                            className="h-7 w-16 text-sm text-right tabular-nums px-2"
                          />
                        </TableCell>
                        <TableCell className="py-2">
                          <Input
                            value={item.note}
                            onChange={(e) =>
                              updateNote(item.productId, e.target.value)
                            }
                            placeholder="Note…"
                            className="h-7 text-xs px-2"
                          />
                        </TableCell>
                        <TableCell className="py-2 pr-3 text-center">
                          <button
                            onClick={() => removeFromCart(item.productId)}
                            className="text-muted-foreground/50 hover:text-destructive transition-colors text-lg leading-none font-light"
                            aria-label="Remove item"
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
                {cart.length > 0 ? (
                  <div>
                    <div className="text-[10px] tracking-widest text-primary-foreground/60 uppercase">
                      Deploying
                    </div>
                    <div className="text-xl font-bold tabular-nums">
                      {totalUnits} unit{totalUnits !== 1 ? "s" : ""}
                    </div>
                  </div>
                ) : (
                  <span className="text-[11px] text-primary-foreground/50 tracking-wide">
                    No items selected
                  </span>
                )}
              </div>
              <button
                onClick={handleDeploy}
                disabled={submitting || !canDeploy}
                className={`
                  px-6 py-2.5 text-xs font-bold tracking-[0.2em] uppercase rounded transition-all
                  ${
                    submitting || !canDeploy
                      ? "bg-primary-foreground/20 text-primary-foreground/40 cursor-not-allowed"
                      : "bg-primary-foreground text-primary hover:bg-primary-foreground/90 active:scale-95"
                  }
                `}
              >
                {submitting ? "Deploying…" : "Deploy to Site →"}
              </button>
            </div>
          </div>

          {/* RIGHT PANEL — Plant Item Picker */}
          <div className="flex flex-col min-h-0">
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
                  <p className="text-xs text-muted-foreground tracking-widest uppercase">
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
                      const inCart = cart.find((c) => c.productId === p.id);
                      return (
                        <TableRow
                          key={p.id}
                          className={`border-b border-border transition-colors group cursor-default
                            ${
                              inCart
                                ? "bg-primary/5 hover:bg-primary/10"
                                : idx % 2 === 0
                                  ? "hover:bg-muted/30"
                                  : "bg-muted/20 hover:bg-muted/30"
                            }`}
                        >
                          <TableCell className="py-3 pl-5">
                            <div className="flex items-center gap-2">
                              {inCart && (
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
                            {inCart && (
                              <span className="text-[10px] text-primary tracking-wider mt-0.5 ml-3.5 block">
                                ×{inCart.quantity} in deployment
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
                              className={`
                                text-[10px] font-bold tracking-[0.15em] uppercase px-3 py-1.5 border rounded transition-all active:scale-95
                                ${
                                  inCart
                                    ? "border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground hover:border-primary"
                                    : "border-border text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary"
                                }
                              `}
                            >
                              {inCart ? "+ Add" : "Add"}
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
