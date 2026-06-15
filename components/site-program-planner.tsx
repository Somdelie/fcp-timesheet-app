"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import type { PointerEvent } from "react";
import {
  addDays,
  differenceInCalendarDays,
  format,
  isAfter,
  isBefore,
} from "date-fns";
import {
  AlertTriangle,
  Building2,
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "react-toastify";

import { SearchableSelect } from "@/components/paint-planning/SearchableSelect";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  createSiteProgramme,
  deleteSiteProgramme,
  getSiteProgramme,
  updateSiteProgramme,
} from "@/actions/job-program";
import { generateProgrammePdf } from "@/lib/generateProgrammePdf";
import {
  downloadExcelBuffer,
  generateProgrammeExcel,
} from "@/lib/generateProgrammeExcel";
import { downloadPdfBlob } from "@/lib/generateSitesPdf";
import { getProgrammeActivityColor } from "@/lib/programmeActivityColors";

type SiteOption = {
  id: string;
  name: string;
  code: string | null;
  client?: string | null;
  latestProgramme?: {
    id: string;
    title: string;
    plannedStartDate: string | null;
    plannedFinishDate: string | null;
    updatedAt: string;
    itemCount: number;
  } | null;
};

type ProgrammeRecord = {
  id: string;
  title: string;
  description: string | null;
  plannedStartDate: string;
  plannedFinishDate: string;
  site?: SiteOption & { client?: string | null };
  items: Array<{
    id: string;
    title: string;
    trade: string | null;
    description: string | null;
    plannedStartDate: string;
    plannedFinishDate: string;
    actualStartDate: string | null;
    actualFinishDate: string | null;
    sortOrder: number;
  }>;
};

type ProgramItem = {
  id: string;
  persistedId?: string;
  name: string;
  trade: string;
  description: string;
  startDate: string;
  finishDate: string;
  actualStartDate?: string;
  actualFinishDate?: string;
};

type Props = {
  sites: SiteOption[];
  initialSiteId: string;
  initialProgramme: ProgrammeRecord | null;
};

type ProgrammeDialogMode = "create" | "edit";
type ScheduleStatus =
  | "planned"
  | "in-progress"
  | "finished"
  | "completed-late"
  | "overdue";
type TimelineDragMode = "move" | "start" | "finish";
type TimelineDrag = {
  itemId: string;
  mode: TimelineDragMode;
  pointerStartX: number;
  originalStartDate: string;
  originalFinishDate: string;
  originalProgrammeStart: string;
  originalProgrammeFinish: string;
};

const today = format(new Date(), "yyyy-MM-dd");
const activityColumnWidth = 300;
const dayColumnWidth = 42;

function dateOnly(value: string | Date | null | undefined) {
  if (!value) return "";
  return format(new Date(value), "yyyy-MM-dd");
}

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function blankItem(startDate: string): ProgramItem {
  return {
    id: makeId(),
    name: "",
    trade: "",
    description: "",
    startDate,
    finishDate: format(addDays(new Date(startDate), 2), "yyyy-MM-dd"),
  };
}

function mapProgramme(programme: ProgrammeRecord | null) {
  return {
    programmeId: programme?.id,
    description: programme?.description ?? "",
    items:
      programme?.items?.length
        ? programme.items.map((item) => ({
            id: makeId(),
            persistedId: item.id,
            name: item.title,
            trade: item.trade ?? "",
            description: item.description ?? "",
            startDate: dateOnly(item.plannedStartDate),
            finishDate: dateOnly(item.plannedFinishDate),
            actualStartDate: dateOnly(item.actualStartDate) || undefined,
            actualFinishDate: dateOnly(item.actualFinishDate) || undefined,
          }))
        : [],
  };
}

function getProgrammeTitle(site: SiteOption | undefined) {
  if (!site) return "Site Programme";
  return `${site.code ? `${site.code} - ` : ""}${site.name}`;
}

function isPastDay(day: Date) {
  return isBefore(day, new Date(today));
}

function isPastWeek(week: Date[]) {
  return week.length > 0 && week.every((day) => isPastDay(day));
}

function getDateRange(programmeItems: ProgramItem[]) {
  if (!programmeItems.length) {
    return { start: today, finish: today };
  }

  const start = programmeItems.reduce(
    (earliest, item) =>
      isBefore(new Date(item.startDate), new Date(earliest))
        ? item.startDate
        : earliest,
    programmeItems[0].startDate,
  );
  const finish = programmeItems.reduce(
    (latest, item) =>
      isAfter(new Date(item.finishDate), new Date(latest))
        ? item.finishDate
        : latest,
    programmeItems[0].finishDate,
  );

  return { start, finish };
}

function sortItemsByStartDate(programmeItems: ProgramItem[]) {
  return programmeItems
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const startDiff =
        new Date(a.item.startDate).getTime() -
        new Date(b.item.startDate).getTime();
      if (startDiff !== 0) return startDiff;

      const finishDiff =
        new Date(a.item.finishDate).getTime() -
        new Date(b.item.finishDate).getTime();
      if (finishDiff !== 0) return finishDiff;

      return a.index - b.index;
    })
    .map(({ item }) => item);
}

export function JobProgramPlanner({
  sites,
  initialSiteId,
  initialProgramme,
}: Props) {
  const [siteRows, setSiteRows] = useState<SiteOption[]>(sites);
  const [selectedSiteId, setSelectedSiteId] = useState(initialSiteId);
  const [programmeId, setProgrammeId] = useState(initialProgramme?.id);
  const [description, setDescription] = useState(
    initialProgramme?.description ?? "",
  );
  const [items, setItems] = useState<ProgramItem[]>(
    mapProgramme(initialProgramme).items,
  );
  const [isPending, startTransition] = useTransition();
  const [loadingSite, setLoadingSite] = useState(false);
  const [siteSearch, setSiteSearch] = useState("");
  const [programmeDialogOpen, setProgrammeDialogOpen] = useState(false);
  const [programmeDialogMode, setProgrammeDialogMode] =
    useState<ProgrammeDialogMode>("create");
  const [draftSiteId, setDraftSiteId] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftItems, setDraftItems] = useState<ProgramItem[]>([]);
  const [timelineDrag, setTimelineDrag] = useState<TimelineDrag | null>(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [excelGenerating, setExcelGenerating] = useState(false);
  const [hasTimelineChanges, setHasTimelineChanges] = useState(false);

  const selectedSite = siteRows.find((site) => site.id === selectedSiteId);
  const selectedSiteLabel = selectedSite ? getProgrammeTitle(selectedSite) : "";

  const programmeSites = useMemo(
    () => siteRows.filter((site) => site.latestProgramme),
    [siteRows],
  );

  const filteredProgrammeSites = useMemo(() => {
    const q = siteSearch.trim().toLowerCase();
    if (!q) return programmeSites;

    return programmeSites.filter((site) =>
      [site.name, site.code, site.client]
        .filter(Boolean)
        .some((part) => part!.toLowerCase().includes(q)),
    );
  }, [programmeSites, siteSearch]);

  const availableCreateSites = useMemo(
    () => siteRows.filter((site) => !site.latestProgramme),
    [siteRows],
  );

  const sortedItems = useMemo(() => sortItemsByStartDate(items), [items]);

  const { start: programmeStart, finish: programmeFinish } = useMemo(
    () => getDateRange(items),
    [items],
  );

  const plannedStart = useMemo(() => {
    if (
      timelineDrag &&
      isBefore(new Date(timelineDrag.originalProgrammeStart), new Date(programmeStart))
    ) {
      return timelineDrag.originalProgrammeStart;
    }
    return programmeStart;
  }, [programmeStart, timelineDrag]);

  const plannedFinish = useMemo(() => {
    if (
      timelineDrag &&
      isAfter(new Date(timelineDrag.originalProgrammeFinish), new Date(programmeFinish))
    ) {
      return timelineDrag.originalProgrammeFinish;
    }
    return programmeFinish;
  }, [programmeFinish, timelineDrag]);

  const calendarFinish = useMemo(() => {
    return items.reduce((latest, item) => {
      const candidate = hasActualFinish(item)
        ? item.actualFinishDate!
        : item.finishDate;
      return isAfter(new Date(candidate), new Date(latest)) ? candidate : latest;
    }, plannedFinish);
  }, [items, plannedFinish]);

  const days = useMemo(() => {
    const total = Math.max(
      0,
      differenceInCalendarDays(new Date(calendarFinish), new Date(plannedStart)),
    );

    return Array.from({ length: total + 1 }).map((_, index) =>
      addDays(new Date(plannedStart), index),
    );
  }, [plannedStart, calendarFinish]);

  const weeks = useMemo(() => {
    const result: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) result.push(days.slice(i, i + 7));
    return result;
  }, [days]);

  const stats = useMemo(() => {
    const completed = items.filter((item) => hasActualFinish(item)).length;
    const lateOrOverdue = items.filter((item) =>
      ["completed-late", "overdue"].includes(getScheduleStatus(item)),
    ).length;
    return { completed, lateOrOverdue };
  }, [items]);

  function resetFromProgramme(programme: ProgrammeRecord | null) {
    const mapped = mapProgramme(programme);
    setProgrammeId(programme?.id);
    setDescription(mapped.description);
    setItems(mapped.items);
    setTimelineDrag(null);
    setHasTimelineChanges(false);
  }

  function updateSiteSummary(siteId: string, programme: ProgrammeRecord | null) {
    setSiteRows((prev) =>
      prev.map((site) =>
        site.id === siteId
          ? {
              ...site,
              latestProgramme: programme
                ? {
                    id: programme.id,
                    title: programme.title,
                    plannedStartDate: programme.plannedStartDate,
                    plannedFinishDate: programme.plannedFinishDate,
                    updatedAt: new Date().toISOString(),
                    itemCount: programme.items.length,
                  }
                : null,
            }
          : site,
      ),
    );
  }

  function handleSiteChange(siteId: string) {
    if (!siteId) return;
    setSelectedSiteId(siteId);
    setLoadingSite(true);
    startTransition(async () => {
      try {
        const programme = (await getSiteProgramme(siteId)) as ProgrammeRecord | null;
        resetFromProgramme(programme);
        updateSiteSummary(siteId, programme);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to load programme.",
        );
      } finally {
        setLoadingSite(false);
      }
    });
  }

  function openCreateProgrammeDialog() {
    if (!availableCreateSites.length) {
      toast.info("All active sites already have programmes.");
      return;
    }

    setProgrammeDialogMode("create");
    setDraftSiteId(availableCreateSites[0]?.id ?? "");
    setDraftDescription("");
    setDraftItems([]);
    setProgrammeDialogOpen(true);
  }

  function openEditProgrammeDialog() {
    if (!programmeId) return;

    setProgrammeDialogMode("edit");
    setDraftSiteId(selectedSiteId);
    setDraftDescription(description);
    setDraftItems(sortedItems.map((item) => ({ ...item })));
    setProgrammeDialogOpen(true);
  }

  function updateDraftItem(id: string, patch: Partial<ProgramItem>) {
    setDraftItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function addDraftItem() {
    setDraftItems((prev) => [
      ...prev,
      blankItem(prev.at(-1)?.finishDate ?? getDateRange(prev).finish),
    ]);
  }

  function duplicateDraftItem(item: ProgramItem) {
    setDraftItems((prev) => [
      ...prev,
      { ...item, id: makeId(), persistedId: undefined, name: `${item.name} copy` },
    ]);
  }

  function deleteDraftItem(id: string) {
    setDraftItems((prev) => prev.filter((item) => item.id !== id));
  }

  function validateProgramme(siteId: string, programmeItems: ProgramItem[]) {
    if (!siteId) return "Select a site first.";
    if (!programmeItems.length) return "Add at least one activity.";

    for (const item of programmeItems) {
      if (!item.name.trim()) return "Every activity needs a name.";
      if (!item.startDate || !item.finishDate) {
        return "Every activity needs a planned start and finish date.";
      }
      if (isAfter(new Date(item.startDate), new Date(item.finishDate))) {
        return `${item.name} starts after it finishes.`;
      }
      if (
        item.actualStartDate &&
        item.actualFinishDate &&
        isAfter(new Date(item.actualStartDate), new Date(item.actualFinishDate))
      ) {
        return `${item.name} has an actual start after its actual finish.`;
      }
    }

    return "";
  }

  function getProgrammePayload(programmeItems: ProgramItem[]) {
    const sortedProgrammeItems = sortItemsByStartDate(programmeItems);
    const range = getDateRange(programmeItems);
    return {
      title: getProgrammeTitle(selectedSite),
      description: description.trim() || undefined,
      plannedStartDate: range.start,
      plannedFinishDate: range.finish,
      items: sortedProgrammeItems.map((item, index) => ({
        id: item.persistedId,
        title: item.name.trim(),
        trade: item.trade.trim() || undefined,
        description: item.description.trim() || undefined,
        plannedStartDate: item.startDate,
        plannedFinishDate: item.finishDate,
        actualStartDate: item.actualStartDate || null,
        actualFinishDate: item.actualFinishDate || null,
        sortOrder: index,
      })),
    };
  }

  function updateItemTimeline(
    currentItems: ProgramItem[],
    drag: TimelineDrag,
    deltaDays: number,
  ) {
    return currentItems.map((item) => {
      if (item.id !== drag.itemId) return item;

      const originalStart = new Date(drag.originalStartDate);
      const originalFinish = new Date(drag.originalFinishDate);

      if (drag.mode === "move") {
        return {
          ...item,
          startDate: format(addDays(originalStart, deltaDays), "yyyy-MM-dd"),
          finishDate: format(addDays(originalFinish, deltaDays), "yyyy-MM-dd"),
        };
      }

      if (drag.mode === "start") {
        const nextStart = addDays(originalStart, deltaDays);
        const clampedStart = isAfter(nextStart, originalFinish)
          ? originalFinish
          : nextStart;
        return {
          ...item,
          startDate: format(clampedStart, "yyyy-MM-dd"),
        };
      }

      const nextFinish = addDays(originalFinish, deltaDays);
      const clampedFinish = isBefore(nextFinish, originalStart)
        ? originalStart
        : nextFinish;
      return {
        ...item,
        finishDate: format(clampedFinish, "yyyy-MM-dd"),
      };
    });
  }

  function saveTimelineItems() {
    if (!programmeId) return;

    const error = validateProgramme(selectedSiteId, items);
    if (error) {
      toast.error(error);
      return;
    }

    startTransition(async () => {
      try {
        const res = await updateSiteProgramme({
          programmeId,
          ...getProgrammePayload(items),
        });

        if (!res?.ok) {
          toast.error(res?.error ?? "Failed to save programme dates.");
          resetFromProgramme(await getSiteProgramme(selectedSiteId));
          return;
        }

        const saved = (await getSiteProgramme(selectedSiteId)) as ProgrammeRecord | null;
        resetFromProgramme(saved);
        updateSiteSummary(selectedSiteId, saved);
        toast.success("Programme dates updated.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to save programme dates.",
        );
        resetFromProgramme(await getSiteProgramme(selectedSiteId));
      }
    });
  }

  function handleTimelinePointerDown(
    event: PointerEvent<HTMLDivElement | HTMLButtonElement>,
    item: ProgramItem,
    mode: TimelineDragMode,
  ) {
    if (isPending || loadingSite) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setTimelineDrag({
      itemId: item.id,
      mode,
      pointerStartX: event.clientX,
      originalStartDate: item.startDate,
      originalFinishDate: item.finishDate,
      originalProgrammeStart: plannedStart,
      originalProgrammeFinish: plannedFinish,
    });
  }

  function handleTimelinePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!timelineDrag) return;

    const deltaDays = Math.round(
      (event.clientX - timelineDrag.pointerStartX) / dayColumnWidth,
    );
    setItems((current) => updateItemTimeline(current, timelineDrag, deltaDays));
  }

  function handleTimelinePointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (!timelineDrag) return;

    const drag = timelineDrag;
    const deltaDays = Math.round(
      (event.clientX - drag.pointerStartX) / dayColumnWidth,
    );
    const nextItems = updateItemTimeline(items, drag, deltaDays);

    setTimelineDrag(null);
    setItems(nextItems);
    if (deltaDays !== 0) setHasTimelineChanges(true);
  }

  async function handleResetTimelineChanges() {
    if (!selectedSiteId) return;

    setLoadingSite(true);
    try {
      const programme = (await getSiteProgramme(selectedSiteId)) as ProgrammeRecord | null;
      resetFromProgramme(programme);
      updateSiteSummary(selectedSiteId, programme);
      toast.info("Programme date changes reset.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to reset programme.",
      );
    } finally {
      setLoadingSite(false);
    }
  }

  function handleSaveProgrammeDialog() {
    const error = validateProgramme(draftSiteId, draftItems);
    if (error) {
      toast.error(error);
      return;
    }

    const draftSite = siteRows.find((site) => site.id === draftSiteId);
    const draftRange = getDateRange(draftItems);
    const sortedDraftItems = sortItemsByStartDate(draftItems);
    const payload = {
      title: getProgrammeTitle(draftSite),
      description: draftDescription.trim() || undefined,
      plannedStartDate: draftRange.start,
      plannedFinishDate: draftRange.finish,
      items: sortedDraftItems.map((item, index) => ({
        id: item.persistedId,
        title: item.name.trim(),
        trade: item.trade.trim() || undefined,
        description: item.description.trim() || undefined,
        plannedStartDate: item.startDate,
        plannedFinishDate: item.finishDate,
        actualStartDate: item.actualStartDate || null,
        actualFinishDate: item.actualFinishDate || null,
        sortOrder: index,
      })),
    };

    startTransition(async () => {
      try {
        const res =
          programmeDialogMode === "edit" && programmeId
          ? await updateSiteProgramme({ programmeId, ...payload })
          : await createSiteProgramme({ siteId: draftSiteId, ...payload });

        if (!res?.ok) {
          toast.error(res?.error ?? "Failed to save programme.");
          return;
        }

        const saved = (await getSiteProgramme(draftSiteId)) as ProgrammeRecord | null;
        setSelectedSiteId(draftSiteId);
        resetFromProgramme(saved);
        updateSiteSummary(draftSiteId, saved);
        setProgrammeDialogOpen(false);

        toast.success("Programme saved.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to save.");
      }
    });
  }

  function handleDeleteProgramme() {
    if (!programmeId) return;
    if (!confirm("Delete this site programme?")) return;

    startTransition(async () => {
      const res = await deleteSiteProgramme(programmeId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      resetFromProgramme(null);
      updateSiteSummary(selectedSiteId, null);
      const nextSite = siteRows.find(
        (site) => site.id !== selectedSiteId && site.latestProgramme,
      );
      if (nextSite) {
        handleSiteChange(nextSite.id);
      }
      toast.success("Programme deleted.");
    });
  }

  async function handleDownloadProgrammePdf() {
    if (!programmeId || !items.length) {
      toast.error("No programme activities to export.");
      return;
    }

    setPdfGenerating(true);
    try {
      const pdfBytes = await generateProgrammePdf({
        siteLabel: selectedSiteLabel || "Site Programme",
        siteCode: selectedSite?.code,
        client: selectedSite?.client,
        description,
        plannedStartDate: plannedStart,
        plannedFinishDate: plannedFinish,
        items: sortedItems.map((item, index) => ({
          name: item.name,
          trade: item.trade,
          startDate: item.startDate,
          finishDate: item.finishDate,
          actualStartDate: item.actualStartDate,
          actualFinishDate: item.actualFinishDate,
          colorIndex: index,
        })),
      });
      const safeName = (selectedSiteLabel || "site-programme")
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase();
      downloadPdfBlob(
        pdfBytes,
        `${safeName || "site-programme"}-${new Date().toISOString().slice(0, 10)}.pdf`,
      );
      toast.success("Programme PDF downloaded.");
    } catch (error) {
      console.error("Programme PDF generation error:", error);
      toast.error("Failed to generate programme PDF.");
    } finally {
      setPdfGenerating(false);
    }
  }

  async function handleDownloadProgrammeExcel() {
    if (!programmeId || !items.length) {
      toast.error("No programme activities to export.");
      return;
    }

    setExcelGenerating(true);
    try {
      const buffer = await generateProgrammeExcel({
        siteLabel: selectedSiteLabel || "Site Programme",
        siteCode: selectedSite?.code,
        client: selectedSite?.client,
        description,
        plannedStartDate: plannedStart,
        plannedFinishDate: plannedFinish,
        items: sortedItems.map((item, index) => ({
          name: item.name,
          trade: item.trade,
          startDate: item.startDate,
          finishDate: item.finishDate,
          actualStartDate: item.actualStartDate,
          actualFinishDate: item.actualFinishDate,
          colorIndex: index,
        })),
      });
      const safeName = (selectedSiteLabel || "site-programme")
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase();
      downloadExcelBuffer(
        buffer,
        `${safeName || "site-programme"}-${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
      toast.success("Programme Excel downloaded.");
    } catch (error) {
      console.error("Programme Excel generation error:", error);
      toast.error("Failed to generate programme Excel.");
    } finally {
      setExcelGenerating(false);
    }
  }

  if (!siteRows.length) {
    return (
      <main className="rounded border border-border bg-card p-6">
        <h1 className="text-2xl font-black">Job / Site Programme Planner</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Add an active site before creating a programme.
        </p>
      </main>
    );
  }

  return (
    <main className="h-[calc(100vh-12rem)] min-h-[560px] overflow-hidden rounded border border-border bg-card shadow-sm">
      <div className="flex h-full min-h-0">
        <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border/50 bg-card">
          <div className="space-y-3 border-b border-border/50 bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h1 className="text-lg font-black">Programmes</h1>
                <p className="text-xs font-bold text-muted-foreground">
                  Saved site programmes.
                </p>
              </div>
              <button
                type="button"
                onClick={openCreateProgrammeDialog}
                className="inline-flex size-8 items-center justify-center rounded bg-primary text-primary-foreground transition hover:bg-primary/90"
                aria-label="Create programme"
              >
                <Plus size={16} />
              </button>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60" />
              <input
                value={siteSearch}
                onChange={(event) => setSiteSearch(event.target.value)}
                placeholder="Search programmes..."
                className="h-9 w-full rounded border border-border/60 bg-background pl-9 pr-3 text-sm font-bold text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary/40"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-2">
            {filteredProgrammeSites.length === 0 ? (
              <div className="p-6 text-center text-sm font-bold text-muted-foreground">
                No saved programmes found.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredProgrammeSites.map((site) => {
                  const active = site.id === selectedSiteId;
                  const programme = site.latestProgramme!;

                  return (
                    <button
                      key={site.id}
                      type="button"
                      onClick={() => handleSiteChange(site.id)}
                      className={`w-full rounded border p-3 text-left transition ${
                        active
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border bg-background hover:border-primary/40 hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div
                          className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded ${
                            active
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <Building2 size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-black">
                            {site.name}
                          </div>
                          <div className="mt-0.5 flex flex-wrap gap-1 text-[11px] font-bold text-muted-foreground">
                            {site.code ? <span>{site.code}</span> : null}
                            {site.client ? <span>{site.client}</span> : null}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                        <span className="rounded bg-primary/10 px-2 py-1 font-black text-primary">
                          Programme
                        </span>
                        <span className="font-bold text-muted-foreground">
                          {programme.itemCount} activities
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        <div className="min-h-0 min-w-0 flex-1 space-y-3 overflow-auto bg-muted/30 p-3">
          {programmeId ? (
            <>
          <section className="rounded border border-border bg-card px-4 py-3 shadow-sm">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-xl font-black">
                    {selectedSiteLabel || "Site Programme"}
                  </h2>
                  {selectedSite?.code ? (
                    <span className="rounded bg-muted px-2 py-1 text-xs font-black text-muted-foreground">
                      {selectedSite.code}
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-muted-foreground">
                  <span>{plannedStart}</span>
                  <span>to</span>
                  <span>{plannedFinish}</span>
                  <span className="text-border">|</span>
                  <span>{items.length} activities</span>
                  <span>{days.length} days</span>
                  <span>{stats.completed} completed</span>
                  <span
                    className={
                      stats.lateOrOverdue
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }
                  >
                    {stats.lateOrOverdue} late / overdue
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {hasTimelineChanges ? (
                  <span className="rounded bg-primary/10 px-3 py-2 text-xs font-black text-primary">
                    Unsaved date changes
                  </span>
                ) : null}
                {hasTimelineChanges ? (
                  <button
                    onClick={saveTimelineItems}
                    disabled={isPending || loadingSite}
                    className="inline-flex items-center justify-center gap-2 rounded bg-primary px-3 py-2 text-sm font-black text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
                  >
                    {isPending ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <Check size={16} />
                    )}
                    Save Dates
                  </button>
                ) : null}
                {hasTimelineChanges ? (
                  <button
                    onClick={handleResetTimelineChanges}
                    disabled={isPending || loadingSite}
                    className="inline-flex items-center justify-center gap-2 rounded border border-border bg-background px-3 py-2 text-sm font-black text-foreground transition hover:bg-muted disabled:opacity-60"
                  >
                    <RotateCcw size={16} />
                    Reset
                  </button>
                ) : null}
                {description.trim() ? (
                  <span className="inline-flex items-center gap-1 rounded border border-border bg-background px-3 py-2 text-xs font-black text-muted-foreground">
                    <FileText size={14} />
                    Notes
                  </span>
                ) : null}
                {programmeId ? (
                  <button
                    onClick={handleDownloadProgrammeExcel}
                    disabled={excelGenerating || loadingSite || !items.length}
                    className="inline-flex items-center justify-center gap-2 rounded border border-border bg-background px-3 py-2 text-sm font-black text-foreground transition hover:bg-muted disabled:opacity-60"
                  >
                    {excelGenerating ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <FileSpreadsheet size={16} />
                    )}
                    Excel
                  </button>
                ) : null}
                {programmeId ? (
                  <button
                    onClick={handleDownloadProgrammePdf}
                    disabled={pdfGenerating || loadingSite || !items.length}
                    className="inline-flex items-center justify-center gap-2 rounded border border-border bg-background px-3 py-2 text-sm font-black text-foreground transition hover:bg-muted disabled:opacity-60"
                  >
                    {pdfGenerating ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <Download size={16} />
                    )}
                    PDF
                  </button>
                ) : null}
                {programmeId ? (
                  <button
                    onClick={handleDeleteProgramme}
                    disabled={isPending}
                    className="inline-flex items-center justify-center gap-2 rounded border border-destructive/30 px-3 py-2 text-sm font-black text-destructive transition hover:bg-destructive/10 disabled:opacity-60"
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                ) : null}
                <button
                  onClick={openEditProgrammeDialog}
                  disabled={isPending || loadingSite}
                  className="inline-flex items-center justify-center gap-2 rounded bg-primary px-4 py-2 text-sm font-black text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
                >
                  {isPending ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <Pencil size={16} />
                  )}
                  Edit Programme
                </button>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded border border-border bg-card shadow-sm">
            <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-black">Programme Calendar</h2>
                <p className="text-sm text-muted-foreground">
                  {loadingSite
                    ? "Loading programme..."
                    : "Week-by-week site activities."}
                </p>
              </div>

            </div>

            <div
              className="overflow-auto"
              onPointerMove={handleTimelinePointerMove}
              onPointerUp={handleTimelinePointerEnd}
              onPointerCancel={handleTimelinePointerEnd}
            >
          <div
            className="grid"
            style={{
              minWidth: `${activityColumnWidth + days.length * dayColumnWidth}px`,
              gridTemplateColumns: `${activityColumnWidth}px repeat(${days.length}, ${dayColumnWidth}px)`,
            }}
          >
            <div className="sticky left-0 z-40 border-b border-r border-border bg-card p-4 font-black shadow-sm">
              Activity
            </div>

            {weeks.map((week, weekIndex) => {
              const pastWeek = isPastWeek(week);

              return (
                <div
                  key={weekIndex}
                  className={`border-b border-r border-l-4 px-3 py-2 text-center text-xs font-black uppercase ${
                    pastWeek
                      ? "border-l-destructive/40 bg-destructive/10 text-destructive"
                      : "border-l-background/80 border-primary/30 bg-primary text-primary-foreground"
                  }`}
                  style={{ gridColumn: `span ${week.length}` }}
                >
                  Week {weekIndex + 1}
                </div>
              );
            })}

            <div className="sticky left-0 z-40 border-b border-r border-border bg-card p-3 text-xs font-bold text-muted-foreground shadow-sm">
              Dates
            </div>

            {days.map((day, dayIndex) => {
              const isToday = dateOnly(day) === today;
              const pastDay = isPastDay(day);
              const weekStart = dayIndex % 7 === 0;

              return (
                <div
                  key={day.toISOString()}
                  className={`border-b border-r border-border py-2 text-center text-[11px] font-bold ${
                    weekStart ? "border-l-4 border-l-primary/70" : ""
                  } ${
                    isToday
                      ? "bg-primary/10 text-primary"
                      : pastDay
                        ? "bg-destructive/10 text-destructive/75"
                        : "bg-card text-muted-foreground"
                  }`}
                >
                  {format(day, "dd")}
                  <br />
                  {format(day, "MMM")}
                </div>
              );
            })}

            {sortedItems.map((item, index) => {
              const startOffset = differenceInCalendarDays(
                new Date(item.startDate),
                new Date(plannedStart),
              );
              const duration =
                differenceInCalendarDays(
                  new Date(item.finishDate),
                  new Date(item.startDate),
                ) + 1;
              const actualDuration = hasActualFinish(item)
                ? differenceInCalendarDays(
                    new Date(item.actualFinishDate!),
                    new Date(item.startDate),
                  ) + 1
                : null;
              const overrunDays =
                isCompletedLate(item)
                  ? differenceInCalendarDays(
                      new Date(item.actualFinishDate!),
                      new Date(item.finishDate),
                    )
                  : 0;
              const hasScheduleIssue = hasLateOrOverdueStatus(item);
              const activityColor = getProgrammeActivityColor(index);

              return (
                <Fragment key={item.id}>
                  <div className="sticky left-0 z-30 border-b border-r border-border bg-card p-4 shadow-sm">
                    <div className="min-w-0 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-black text-foreground">
                            {index + 1}. {item.name}
                          </div>
                          {item.trade ? (
                            <div className="mt-1 truncate text-xs font-bold text-muted-foreground">
                              {item.trade}
                            </div>
                          ) : null}
                        </div>
                        <StatusPill item={item} />
                      </div>

                      <div className="grid grid-cols-1 gap-2 min-[1180px]:grid-cols-2">
                        <DateChip label="Start" value={item.startDate} />
                        <DateChip label="Finish" value={item.finishDate} />
                      </div>

                      <div className="rounded bg-muted/50 px-3 py-2 text-xs font-bold text-muted-foreground">
                        Planned <b className="text-foreground">{Math.max(duration, 0)}</b> days
                        {actualDuration ? (
                          <>
                            {" | "}
                            Actual <b className="text-foreground">{actualDuration}</b> days
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {days.map((day, dayIndex) => {
                    const pastDay = isPastDay(day);
                    const weekStart = dayIndex % 7 === 0;
                    const isInside =
                      dayIndex >= startOffset &&
                      dayIndex < startOffset + Math.max(duration, 0);
                    const isFirst = dayIndex === startOffset;
                    const isOverrun =
                      overrunDays > 0 &&
                      dayIndex >= startOffset + duration &&
                      dayIndex < startOffset + duration + overrunDays;

                    return (
                      <div
                        key={`${item.id}-${day.toISOString()}`}
                        className={`relative h-[164px] border-b border-r border-border ${
                          weekStart ? "border-l-4 border-l-primary/70" : ""
                        } ${pastDay ? "bg-destructive/5" : "bg-card"}`}
                      >
                        {(isInside || isOverrun) && (
                          <div
                            className={`absolute inset-y-12 left-0 right-0 z-0 border-y ${
                              isOverrun
                                ? "border-destructive/30 bg-destructive/20"
                                : `border-transparent ${activityColor.trackClass}`
                            }`}
                          />
                        )}

                        {isFirst && (
                          <div
                            onPointerDown={(event) =>
                              handleTimelinePointerDown(event, item, "move")
                            }
                            className={`absolute left-1 top-11 z-20 flex h-9 min-w-0 items-center overflow-hidden rounded border px-3 text-xs font-black shadow-sm ${
                              hasScheduleIssue
                                ? "border-destructive bg-destructive text-destructive-foreground"
                                : activityColor.barClass
                            } cursor-grab select-none active:cursor-grabbing`}
                            style={{
                              width: `${Math.max(duration, 1) * dayColumnWidth - 8}px`,
                              touchAction: "none",
                            }}
                          >
                            <button
                              type="button"
                              onPointerDown={(event) =>
                                handleTimelinePointerDown(event, item, "start")
                              }
                              className={`absolute inset-y-0 left-0 z-10 w-3 cursor-ew-resize border-r opacity-70 transition hover:opacity-100 focus:opacity-100 ${activityColor.handleClass}`}
                              aria-label={`Resize ${item.name} start date`}
                            />
                            <span className="truncate">
                              {index + 1}. {item.name}
                            </span>
                            {hasScheduleIssue ? (
                              <AlertTriangle className="ml-2 shrink-0" size={14} />
                            ) : null}
                            <button
                              type="button"
                              onPointerDown={(event) =>
                                handleTimelinePointerDown(event, item, "finish")
                              }
                              className={`absolute inset-y-0 right-0 z-10 w-3 cursor-ew-resize border-l opacity-70 transition hover:opacity-100 focus:opacity-100 ${activityColor.handleClass}`}
                              aria-label={`Resize ${item.name} finish date`}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </Fragment>
              );
            })}
          </div>
        </div>

        {!loadingSite && items.length === 0 ? (
          <div className="border-t border-border bg-muted/30 p-8 text-center">
            <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded bg-background text-muted-foreground shadow-sm">
              <FileText size={20} />
            </div>
            <p className="text-sm font-bold text-muted-foreground">
              No programme activities saved for this site yet.
            </p>
          </div>
        ) : null}
          </section>
            </>
          ) : (
            <EmptyProgrammeState onCreate={openCreateProgrammeDialog} />
          )}
        </div>
      </div>

      <Dialog open={programmeDialogOpen} onOpenChange={setProgrammeDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {programmeDialogMode === "create"
                ? "Create Programme"
                : "Edit Programme"}
            </DialogTitle>
            <DialogDescription>
              Set the site notes and programme activities here. The calendar
              updates after saving.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 space-y-4 overflow-auto pr-1">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <Field label="Site">
                <SearchableSelect
                  value={draftSiteId}
                  onValueChange={setDraftSiteId}
                  placeholder={
                    availableCreateSites.length || programmeDialogMode === "edit"
                      ? "Search and select site..."
                      : "All active sites already have programmes"
                  }
                  disabled={programmeDialogMode === "edit"}
                  options={
                    programmeDialogMode === "edit"
                      ? siteRows
                          .filter((site) => site.id === selectedSiteId)
                          .map((site) => ({
                            value: site.id,
                            label: getProgrammeTitle(site),
                          }))
                      : availableCreateSites.map((site) => ({
                          value: site.id,
                          label: getProgrammeTitle(site),
                        }))
                  }
                />
              </Field>

              <Field label="Notes">
                <Textarea
                  value={draftDescription}
                  onChange={(event) => setDraftDescription(event.target.value)}
                  placeholder="Optional"
                  className="min-h-20"
                />
              </Field>
            </div>

            <div className="rounded border border-border bg-background">
              <div className="flex items-center justify-between gap-3 border-b border-border p-3">
                <div>
                  <h3 className="text-sm font-black">Activities</h3>
                  <p className="text-xs font-bold text-muted-foreground">
                    Add the planned and actual dates for this programme.
                  </p>
                </div>
                <Button type="button" size="sm" onClick={addDraftItem}>
                  <Plus size={15} />
                  Add Activity
                </Button>
              </div>

              {draftItems.length ? (
                <div className="max-h-[44vh] space-y-3 overflow-auto p-3">
                  {draftItems.map((item, index) => (
                    <div
                      key={item.id}
                      className="rounded border border-border bg-card p-3"
                    >
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-muted-foreground">
                          Activity {index + 1}
                        </span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => duplicateDraftItem(item)}
                            className="rounded border border-border bg-background p-1.5 text-muted-foreground transition hover:bg-muted"
                            aria-label="Duplicate activity"
                          >
                            <Copy size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteDraftItem(item.id)}
                            className="rounded border border-destructive/30 bg-background p-1.5 text-destructive transition hover:bg-destructive/10"
                            aria-label="Delete activity"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <Field label="Activity">
                          <input
                            value={item.name}
                            onChange={(event) =>
                              updateDraftItem(item.id, {
                                name: event.target.value,
                              })
                            }
                            className="h-9 w-full rounded border border-border bg-background px-3 text-sm font-bold text-foreground outline-none focus:border-primary/40"
                            placeholder="Activity name"
                          />
                        </Field>
                        <Field label="Trade / team">
                          <input
                            value={item.trade}
                            onChange={(event) =>
                              updateDraftItem(item.id, {
                                trade: event.target.value,
                              })
                            }
                            className="h-9 w-full rounded border border-border bg-background px-3 text-sm font-bold text-foreground outline-none focus:border-primary/40"
                            placeholder="Optional"
                          />
                        </Field>
                        <Field label="Planned start">
                          <DateInput
                            value={item.startDate}
                            onChange={(value) =>
                              updateDraftItem(item.id, { startDate: value })
                            }
                            label="Planned start"
                          />
                        </Field>
                        <Field label="Planned finish">
                          <DateInput
                            value={item.finishDate}
                            onChange={(value) =>
                              updateDraftItem(item.id, { finishDate: value })
                            }
                            label="Planned finish"
                          />
                        </Field>
                        <Field label="Actual start">
                          <DateInput
                            value={item.actualStartDate ?? ""}
                            onChange={(value) =>
                              updateDraftItem(item.id, {
                                actualStartDate: value || undefined,
                              })
                            }
                            label="Actual start"
                          />
                        </Field>
                        <Field label="Actual finish">
                          <DateInput
                            value={item.actualFinishDate ?? ""}
                            onChange={(value) =>
                              updateDraftItem(item.id, {
                                actualFinishDate: value || undefined,
                              })
                            }
                            label="Actual finish"
                          />
                        </Field>
                      </div>

                      <Field label="Activity notes">
                        <Textarea
                          value={item.description}
                          onChange={(event) =>
                            updateDraftItem(item.id, {
                              description: event.target.value,
                            })
                          }
                          placeholder="Optional"
                          className="mt-3 min-h-20"
                        />
                      </Field>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded bg-muted text-muted-foreground">
                    <FileText size={18} />
                  </div>
                  <p className="text-sm font-bold text-muted-foreground">
                    No activities added yet.
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setProgrammeDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveProgrammeDialog}
              disabled={isPending || !draftSiteId}
            >
              {isPending ? (
                <Loader2 className="animate-spin" size={16} />
              ) : null}
              Save Programme
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </main>
  );
}

function getScheduleStatus(item: ProgramItem): ScheduleStatus {
  if (hasActualFinish(item)) {
    return isCompletedLate(item) ? "completed-late" : "finished";
  }

  if (isAfter(new Date(today), new Date(item.finishDate))) {
    return "overdue";
  }

  if (
    (item.actualStartDate &&
      !isAfter(new Date(item.actualStartDate), new Date(today))) ||
    !isAfter(new Date(item.startDate), new Date(today))
  ) {
    return "in-progress";
  }

  return "planned";
}

function isCompletedLate(item: ProgramItem) {
  return Boolean(
    hasActualFinish(item) &&
      isAfter(new Date(item.actualFinishDate!), new Date(item.finishDate)),
  );
}

function hasActualFinish(item: ProgramItem) {
  return Boolean(
    item.actualFinishDate &&
      !isAfter(new Date(item.actualFinishDate), new Date(today)),
  );
}

function hasLateOrOverdueStatus(item: ProgramItem) {
  return ["completed-late", "overdue"].includes(getScheduleStatus(item));
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <span className="text-xs font-black uppercase text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

function EmptyProgrammeState({ onCreate }: { onCreate: () => void }) {
  return (
    <section className="flex h-full min-h-[420px] items-center justify-center rounded border border-dashed border-border bg-card p-8 text-center">
      <div className="max-w-sm">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded bg-muted text-muted-foreground">
          <FileText size={22} />
        </div>
        <h2 className="text-lg font-black">No programme selected</h2>
        <p className="mt-2 text-sm font-bold text-muted-foreground">
          Create a programme for a site to start building the calendar.
        </p>
        <Button type="button" className="mt-5" onClick={onCreate}>
          <Plus size={16} />
          Create Programme
        </Button>
      </div>
    </section>
  );
}

function DateInput({
  value,
  label,
  onChange,
}: {
  value: string;
  label: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1">
      <span className="sr-only">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded border border-border bg-background px-2 py-1 text-xs font-bold text-foreground outline-none focus:border-primary/40"
        title={label}
      />
    </label>
  );
}

function DateChip({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div
      className={`rounded border px-2.5 py-2 ${
        muted
          ? "border-border bg-muted/30"
          : "border-primary/20 bg-primary/5"
      }`}
    >
      <div className="text-[10px] font-black uppercase text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 truncate text-xs font-black text-foreground">
        {value}
      </div>
    </div>
  );
}

function StatusPill({ item }: { item: ProgramItem }) {
  const status = getScheduleStatus(item);

  const className =
    status === "completed-late" || status === "overdue"
      ? "bg-destructive/10 text-destructive"
      : status === "finished"
        ? "bg-primary/10 text-primary"
        : status === "in-progress"
          ? "bg-muted text-foreground"
          : "bg-muted text-muted-foreground";

  const label =
    status === "completed-late"
      ? "Completed late"
      : status === "overdue"
        ? "Overdue"
        : status === "finished"
          ? "Finished"
          : status === "in-progress"
            ? "In progress"
            : "Planned";

  return (
    <span className={`rounded px-2 py-1 text-xs font-black ${className}`}>
      {label}
    </span>
  );
}
