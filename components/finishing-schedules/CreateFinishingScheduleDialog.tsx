"use client";

import * as React from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import {
  Check,
  ChevronsUpDown,
  Loader2,
  Paintbrush,
  Plus,
  Trash2,
  Maximize2,
  Minimize2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  createFinishingSchedule,
  getFinishingScheduleSiteDefaults,
  listSuppliersForSchedule,
  listSitePaintColorsForSchedule,
} from "@/actions/site-finishing-schedule";
import type { FinishingZone } from "@/generated/prisma/client";

type SiteOption = {
  id: string;
  name: string;
  code: string | null;
  client?: string | null;
  contractNo?: string | null;
  contractManager?: string | null;
  siteForeman?: string | null;
  fcpContractManager?: string | null;
  fcpQs?: string | null;
  fcpSiteForeman?: string | null;
};

type SupplierOption = { id: string; name: string };

type SitePaintColorOption = {
  id: string;
  colorName: string;
  colorCode: string | null;
  baseType: string;
  productId: string | null;
  productSnapshot: string | null;
  supplierId: string | null;
  supplierSnapshot: string | null;
  product: { id: string; name: string } | null;
  supplier: { id: string; name: string } | null;
};

type FinishLine = {
  id: string;
  colorId: string;
  zone: FinishingZone;
  product: string;
  supplierId: string;
  usage: string;
};

type ScheduleLogoKey = "FIRST_CLASS" | "UNWABU";

interface Props {
  siteId?: string;
  sites?: SiteOption[];
  suppliers?: SupplierOption[];
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  label?: string;
}

const DEFAULT_USAGE_OPTIONS = [
  "Walls",
  "External Walls",
  "Internal Walls",
  "Ceilings",
  "Soffits",
  "Doors",
  "Doorframes",
  "Window Sills",
  "Stills",
  "Skirtings",
  "Steelwork",
  "Steel Staircase",
  "Timber Ceilings",
  "Bulkheads",
  "Bollards",
  "Corner Protectors",
  "Backing Boards",
  "Feature Wall",
  "Accent Colour",
  "Main Colour",
  "Gate",
  "Fence",
  "Yard",
  "Bathroom Walls",
  "Bathroom Doors",
  "Service Duct Walls",
  "Refuse Yard",
  "Transformer Doors",
];

const LOGO_OPTIONS: Array<{ value: ScheduleLogoKey; label: string }> = [
  { value: "FIRST_CLASS", label: "FirstClass Projects" },
  { value: "UNWABU", label: "Unwabu Painting" },
];

function siteLabel(site: SiteOption | undefined) {
  if (!site) return "Select site";
  return site.code ? `${site.code} - ${site.name}` : site.name;
}

function paintColorLabel(color: SitePaintColorOption | undefined) {
  if (!color) return "Select colour";
  const code = color.colorCode ? ` ${color.colorCode}` : "";
  const base =
    color.baseType && color.baseType !== "NEUTRAL"
      ? ` (${color.baseType})`
      : "";
  return `${color.colorName}${code}${base}`;
}

function colorProduct(color: SitePaintColorOption | undefined) {
  return color?.product?.name ?? color?.productSnapshot ?? "";
}

function colorSupplier(color: SitePaintColorOption | undefined) {
  return color?.supplier?.name ?? color?.supplierSnapshot ?? "";
}

function newLine(color?: SitePaintColorOption): FinishLine {
  return {
    id: crypto.randomUUID(),
    colorId: color?.id ?? "",
    zone: "INTERNAL",
    product: colorProduct(color),
    supplierId: color?.supplier?.id ?? color?.supplierId ?? "",
    usage: "",
  };
}

export default function CreateFinishingScheduleDialog({
  siteId: fixedSiteId,
  sites = [],
  suppliers = [],
  variant = "default",
  size = "default",
  label = "New Schedule",
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [siteOpen, setSiteOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [colorsPending, startColorsTransition] = useTransition();
  const [lookupPending, startLookupTransition] = useTransition();

  const [selectedSiteId, setSelectedSiteId] = useState(fixedSiteId ?? "");
  const [sitePaintColors, setSitePaintColors] = useState<
    SitePaintColorOption[]
  >([]);
  const [supplierOptions, setSupplierOptions] =
    useState<SupplierOption[]>(suppliers);
  const [usageOptions, setUsageOptions] = useState(DEFAULT_USAGE_OPTIONS);
  const [customUsage, setCustomUsage] = useState("");
  const [lines, setLines] = useState<FinishLine[]>([]);
  const editorRef = React.useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [contractNo, setContractNo] = useState("");
  const [contractManager, setContractManager] = useState("");
  const [siteForeman, setSiteForeman] = useState("");
  const [fcpContractManager, setFcpContractManager] = useState("");
  const [fcpQs, setFcpQs] = useState("");
  const [fcpSiteForeman, setFcpSiteForeman] = useState("");
  const [client, setClient] = useState("");
  const [startDate, setStartDate] = useState("");
  const [completionDate, setCompletionDate] = useState("");
  const [drawingDetails, setDrawingDetails] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [logoKey, setLogoKey] = useState<ScheduleLogoKey>("FIRST_CLASS");

  const selectedSite = useMemo(
    () => sites.find((site) => site.id === selectedSiteId),
    [selectedSiteId, sites],
  );

  const selectedColorsById = useMemo(
    () => new Map(sitePaintColors.map((color) => [color.id, color])),
    [sitePaintColors],
  );

  const suppliersById = useMemo(
    () => new Map(supplierOptions.map((supplier) => [supplier.id, supplier])),
    [supplierOptions],
  );

  const lineItems = lines.filter(
    (line) => line.colorId && line.zone && line.usage.trim(),
  );

  useEffect(() => {
    if (!open || !selectedSite) return;

    setContractNo(selectedSite.contractNo ?? selectedSite.code ?? "");
    setClient(selectedSite.client ?? "");
    setContractManager(selectedSite.contractManager ?? "");
    setSiteForeman(selectedSite.siteForeman ?? "");
    setFcpContractManager(selectedSite.fcpContractManager ?? "");
    setFcpQs(selectedSite.fcpQs ?? "");
    setFcpSiteForeman(selectedSite.fcpSiteForeman ?? "");
  }, [open, selectedSite]);

  useEffect(() => {
    if (!open || supplierOptions.length > 0) return;

    startLookupTransition(async () => {
      const res = await listSuppliersForSchedule();
      if (res.ok) setSupplierOptions(res.suppliers);
    });
  }, [open, supplierOptions.length]);

  useEffect(() => {
    if (!open || !fixedSiteId || selectedSite) return;

    startLookupTransition(async () => {
      const res = await getFinishingScheduleSiteDefaults(fixedSiteId);
      if (!res.ok) return;

      setContractNo(res.site.contractNo ?? res.site.code ?? "");
      setClient(res.site.client ?? "");
      setFcpContractManager(res.site.fcpContractManager ?? "");
      setFcpSiteForeman(res.site.fcpSiteForeman ?? "");
    });
  }, [fixedSiteId, open, selectedSite]);

  useEffect(() => {
    if (!open || !selectedSiteId) {
      setSitePaintColors([]);
      return;
    }

    startColorsTransition(async () => {
      const res = await listSitePaintColorsForSchedule(selectedSiteId);

      if (!res.ok) {
        toast.error(res.error ?? "Failed to load site colours.");
        setSitePaintColors([]);
        return;
      }

      setSitePaintColors(res.colors);

      setLines((prev) =>
        prev.map((line) =>
          line.colorId && !res.colors.some((color) => color.id === line.colorId)
            ? { ...line, colorId: "", product: "" }
            : line,
        ),
      );
    });
  }, [open, selectedSiteId]);

  // Fullscreen change handler to update state
  useEffect(() => {
    const handler = () => {
      setIsFullscreen(document.fullscreenElement === editorRef.current);
    };

    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!editorRef.current) return;
      if (!document.fullscreenElement) {
        // enter fullscreen for the editor container
        await editorRef.current.requestFullscreen?.();
      } else {
        await document.exitFullscreen?.();
      }
    } catch (err) {
      // ignore fullscreen errors
    }
  };

  function reset() {
    if (!fixedSiteId) setSelectedSiteId("");
    setSitePaintColors([]);
    setSupplierOptions(suppliers);
    setUsageOptions(DEFAULT_USAGE_OPTIONS);
    setCustomUsage("");
    setLines([]);
    setContractNo("");
    setContractManager("");
    setSiteForeman("");
    setFcpContractManager("");
    setFcpQs("");
    setFcpSiteForeman("");
    setClient("");
    setStartDate("");
    setCompletionDate("");
    setDrawingDetails("");
    setContactInfo("");
    setLogoKey("FIRST_CLASS");
  }

  function addLine(color?: SitePaintColorOption) {
    setLines((prev) => [...prev, newLine(color)]);
  }

  function updateLine(id: string, patch: Partial<FinishLine>) {
    setLines((prev) =>
      prev.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    );
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((line) => line.id !== id));
  }

  function handleColorChange(lineId: string, colorId: string) {
    const color = selectedColorsById.get(colorId);
    updateLine(lineId, {
      colorId,
      product: colorProduct(color),
      supplierId: color?.supplier?.id ?? color?.supplierId ?? "",
    });
  }

  function addCustomUsage() {
    const next = customUsage.trim();
    if (!next) return;

    setUsageOptions((prev) =>
      prev.some((usage) => usage.toLowerCase() === next.toLowerCase())
        ? prev
        : [...prev, next].sort((a, b) => a.localeCompare(b)),
    );

    setCustomUsage("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const siteId = fixedSiteId ?? selectedSiteId;

    if (!siteId) {
      toast.error("Please select a site.");
      return;
    }

    if (lines.length > 0 && lineItems.length === 0) {
      toast.error("Select a colour and usage for at least one finish line.");
      return;
    }

    startTransition(async () => {
      const res = await createFinishingSchedule({
        siteId,
        contractNo: contractNo || null,
        contractManager: contractManager || null,
        siteForeman: siteForeman || null,
        fcpContractManager: fcpContractManager || null,
        fcpQs: fcpQs || null,
        fcpSiteForeman: fcpSiteForeman || null,
        client: client || null,
        startDate: startDate || null,
        completionDate: completionDate || null,
        drawingDetails: drawingDetails || null,
        contactInfo: contactInfo || null,
        logoKey,
        areas: lineItems.length
          ? [
              {
                name: "Finishes",
                label: "Site colours and usage",
                sortOrder: 0,
                items: lineItems.map((line, index) => {
                  const color = selectedColorsById.get(line.colorId);

                  return {
                    zone: line.zone,
                    position: line.usage.trim(),
                    product: line.product.trim() || colorProduct(color) || null,
                    colorCode: paintColorLabel(color),
                    supplier:
                      suppliersById.get(line.supplierId)?.name ||
                      colorSupplier(color) ||
                      null,
                    sortOrder: index,
                    note: null,
                  };
                }),
              },
            ]
          : undefined,
      });

      if (!res.ok) {
        toast.error(res.error ?? "Failed to create schedule.");
        return;
      }

      toast.success("Finishing schedule created.");
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) reset();
      }}
    >
      <SheetTrigger asChild>
        <Button variant={variant} size={size}>
          <Plus className="mr-2 h-4 w-4" />
          {label}
        </Button>
      </SheetTrigger>

      <SheetContent
        side="bottom"
        className="h-[94dvh] max-h-[94dvh] gap-0 overflow-hidden rounded-t-lg p-0"
      >
        <SheetHeader className="border-b px-5 py-4">
          <div className="flex items-start justify-between gap-4 pr-8">
            <div>
              <SheetTitle>Create Finishing Schedule</SheetTitle>
              <SheetDescription>
                Build the schedule from colours already used on the selected
                site.
              </SheetDescription>
            </div>

            <Badge variant="outline" className="mt-0.5">
              {lineItems.length} selected
            </Badge>
          </div>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div
            ref={editorRef}
            className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden xl:grid-cols-[520px_minmax(0,1fr)]"
          >
            <aside className="space-y-4 overflow-y-auto border-b bg-muted/30 p-4 xl:border-b-0 xl:border-r">
              {!fixedSiteId && (
                <div className="space-y-1.5">
                  <Label>Site *</Label>

                  <Popover open={siteOpen} onOpenChange={setSiteOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={siteOpen}
                        className="w-full justify-between"
                      >
                        <span className="truncate">
                          {selectedSiteId
                            ? siteLabel(selectedSite)
                            : "Select site"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>

                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        <CommandInput placeholder="Search sites..." />
                        <CommandList>
                          <CommandEmpty>No sites found.</CommandEmpty>
                          <CommandGroup>
                            {sites.map((site) => (
                              <CommandItem
                                key={site.id}
                                value={siteLabel(site)}
                                onSelect={() => {
                                  setSelectedSiteId(site.id);
                                  setLines([]);
                                  setSiteOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedSiteId === site.id
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                                {siteLabel(site)}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Contract No">
                  <Input
                    value={contractNo}
                    onChange={(e) => setContractNo(e.target.value)}
                  />
                </Field>

                <Field label="Client">
                  <Input
                    value={client}
                    onChange={(e) => setClient(e.target.value)}
                  />
                </Field>
              </div>

              <Field label="Contract Manager">
                <Input
                  value={contractManager}
                  onChange={(e) => setContractManager(e.target.value)}
                />
              </Field>

              <Field label="Site Foreman">
                <Input
                  value={siteForeman}
                  onChange={(e) => setSiteForeman(e.target.value)}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="FCP Manager">
                  <Input
                    value={fcpContractManager}
                    onChange={(e) => setFcpContractManager(e.target.value)}
                  />
                </Field>

                <Field label="FCP QS">
                  <Input
                    value={fcpQs}
                    onChange={(e) => setFcpQs(e.target.value)}
                  />
                </Field>
              </div>

              <Field label="FCP Site Foreman">
                <Input
                  value={fcpSiteForeman}
                  onChange={(e) => setFcpSiteForeman(e.target.value)}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Start">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </Field>

                <Field label="Completion">
                  <Input
                    type="date"
                    value={completionDate}
                    onChange={(e) => setCompletionDate(e.target.value)}
                  />
                </Field>
              </div>

              <Field label="Drawing details">
                <Input
                  value={drawingDetails}
                  onChange={(e) => setDrawingDetails(e.target.value)}
                />
              </Field>

              <Field label="Contact info">
                <Input
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                />
              </Field>

              <Field label="PDF Logo">
                <Select
                  value={logoKey}
                  onValueChange={(value) =>
                    setLogoKey(value as ScheduleLogoKey)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select PDF logo" />
                  </SelectTrigger>
                  <SelectContent>
                    {LOGO_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </aside>

            <main className="flex min-h-0 flex-col overflow-hidden">
              <div className="flex flex-col gap-3 border-b p-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Paintbrush className="h-4 w-4" />
                    Site Colours
                    {colorsPending && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    )}
                  </div>

                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Pick a site colour, choose internal or external, then assign
                    the usage.
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 items-center gap-2">
                    <Input
                      value={customUsage}
                      onChange={(e) => setCustomUsage(e.target.value)}
                      placeholder="New usage"
                      className="h-9 w-full sm:w-44"
                    />

                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={addCustomUsage}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button type="button" onClick={() => addLine()}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Line
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      title={isFullscreen ? "Exit full screen" : "Full screen"}
                      onClick={toggleFullscreen}
                      className="h-9 w-9"
                    >
                      {isFullscreen ? (
                        <Minimize2 className="h-4 w-4" />
                      ) : (
                        <Maximize2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {sitePaintColors.length > 0 && (
                <div className="flex gap-2 overflow-x-auto border-b px-4 py-3">
                  {sitePaintColors.map((color) => (
                    <button
                      key={color.id}
                      type="button"
                      className="flex min-w-52 items-center gap-2 rounded border bg-background px-3 py-2 text-left text-xs hover:bg-muted"
                      onClick={() => addLine(color)}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border bg-muted text-[10px] font-semibold">
                        {color.colorName.slice(0, 2).toUpperCase()}
                      </span>

                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {paintColorLabel(color)}
                        </span>

                        <span className="block truncate text-muted-foreground">
                          {colorProduct(color) ||
                            colorSupplier(color) ||
                            "Site colour"}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div className="min-h-0 flex-1 overflow-auto p-4">
                {selectedSiteId &&
                !colorsPending &&
                sitePaintColors.length === 0 ? (
                  <EmptyState text="No colours have been captured for this site yet. You can still add schedule header details and create the schedule." />
                ) : lines.length === 0 ? (
                  <EmptyState text="Select a colour chip or use Add Line to start building the schedule." />
                ) : (
                  <div className="overflow-hidden rounded border">
                    <Table className="border-collapse">
                      <TableHeader className="bg-muted/60">
                        <TableRow>
                          <TableHead className="border px-3 py-2">
                            Colour
                          </TableHead>
                          <TableHead className="border px-3 py-2">
                            Area
                          </TableHead>
                          <TableHead className="border px-3 py-2">
                            Product
                          </TableHead>
                          <TableHead className="border px-3 py-2">
                            Used On
                          </TableHead>
                          <TableHead className="border px-3 py-2">
                            Supplier
                          </TableHead>
                          <TableHead className="w-12 border px-2 py-2" />
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {lines.map((line) => {
                          const color = selectedColorsById.get(line.colorId);

                          return (
                            <TableRow key={line.id}>
                              <TableCell className="min-w-64 border p-2">
                                <SearchCombobox
                                  value={line.colorId || "__none__"}
                                  onChange={(value) =>
                                    handleColorChange(
                                      line.id,
                                      value === "__none__" ? "" : value,
                                    )
                                  }
                                  placeholder="Select colour"
                                  emptyText="No colours found."
                                  options={[
                                    {
                                      value: "__none__",
                                      label: "Select colour",
                                    },
                                    ...sitePaintColors.map((option) => ({
                                      value: option.id,
                                      label: paintColorLabel(option),
                                      description:
                                        colorProduct(option) ||
                                        colorSupplier(option) ||
                                        undefined,
                                    })),
                                  ]}
                                />

                                {color ? (
                                  <div className="mt-1 truncate text-xs text-muted-foreground">
                                    {colorProduct(color) || "No product"}
                                  </div>
                                ) : null}
                              </TableCell>

                              <TableCell className="min-w-36 border p-2">
                                <SearchCombobox
                                  value={line.zone}
                                  onChange={(value) =>
                                    updateLine(line.id, {
                                      zone: value as FinishingZone,
                                    })
                                  }
                                  placeholder="Select area"
                                  emptyText="No areas found."
                                  options={[
                                    { value: "INTERNAL", label: "Internal" },
                                    { value: "EXTERNAL", label: "External" },
                                  ]}
                                />
                              </TableCell>

                              <TableCell className="min-w-56 border p-2">
                                <Input
                                  value={line.product}
                                  onChange={(e) =>
                                    updateLine(line.id, {
                                      product: e.target.value,
                                    })
                                  }
                                  placeholder="Product"
                                  className="h-9"
                                />
                              </TableCell>

                              <TableCell className="min-w-48 border p-2">
                                <SearchCombobox
                                  value={line.usage || "__none__"}
                                  onChange={(value) =>
                                    updateLine(line.id, {
                                      usage: value === "__none__" ? "" : value,
                                    })
                                  }
                                  placeholder="Select usage"
                                  emptyText="No usages found."
                                  options={[
                                    {
                                      value: "__none__",
                                      label: "Select usage",
                                    },
                                    ...usageOptions.map((usage) => ({
                                      value: usage,
                                      label: usage,
                                    })),
                                  ]}
                                />
                              </TableCell>

                              <TableCell className="min-w-52 border p-2">
                                <SearchCombobox
                                  value={line.supplierId || "__none__"}
                                  onChange={(value) =>
                                    updateLine(line.id, {
                                      supplierId:
                                        value === "__none__" ? "" : value,
                                    })
                                  }
                                  placeholder="Select supplier"
                                  emptyText="No suppliers found."
                                  options={[
                                    {
                                      value: "__none__",
                                      label: "Select supplier",
                                    },
                                    ...supplierOptions.map((supplier) => ({
                                      value: supplier.id,
                                      label: supplier.name,
                                    })),
                                  ]}
                                />
                              </TableCell>

                              <TableCell className="border p-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 text-muted-foreground hover:text-destructive"
                                  onClick={() => removeLine(line.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </main>
          </div>

          <SheetFooter className="flex-row items-center justify-end gap-2 border-t bg-background px-5 py-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={pending || colorsPending || lookupPending}
            >
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex min-h-72 items-center justify-center rounded border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function SearchCombobox({
  value,
  onChange,
  options,
  placeholder,
  emptyText,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string; description?: string }>;
  placeholder: string;
  emptyText: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-9 w-full justify-between px-3 font-normal"
        >
          <span className="truncate text-left">
            {selected?.label ?? placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.description ?? ""}`}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      option.value === value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="min-w-0">
                    <span className="block truncate">{option.label}</span>
                    {option.description ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
