"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { Check, Loader2, RotateCcw, Search, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface TrashItem {
  id: string;
  entityType: string;
  entityId: string;
  label: string;
  description: string | null;
  deletedByName: string | null;
  deletedAt: string;
  expiresAt: string;
}

type PendingAction = "restore" | "clear" | null;

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminTrashPage() {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(term) ||
        item.entityType.toLowerCase().includes(term) ||
        (item.description ?? "").toLowerCase().includes(term),
    );
  }, [items, search]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allVisibleSelected =
    filteredItems.length > 0 &&
    filteredItems.every((item) => selectedSet.has(item.id));
  const someVisibleSelected =
    filteredItems.some((item) => selectedSet.has(item.id)) &&
    !allVisibleSelected;

  useEffect(() => {
    void loadTrash();
  }, []);

  async function loadTrash() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/trash");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load trash");
      const nextItems: TrashItem[] = data.items || [];
      setItems(nextItems);
      setSelectedIds((ids) =>
        ids.filter((id) => nextItems.some((item) => item.id === id)),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load trash");
    } finally {
      setLoading(false);
    }
  }

  function toggleItem(id: string, checked: boolean) {
    setSelectedIds((ids) =>
      checked
        ? ids.includes(id)
          ? ids
          : [...ids, id]
        : ids.filter((itemId) => itemId !== id),
    );
  }

  function toggleVisible(checked: boolean) {
    const visibleIds = filteredItems.map((item) => item.id);
    setSelectedIds((ids) => {
      if (!checked) return ids.filter((id) => !visibleIds.includes(id));
      const next = new Set(ids);
      visibleIds.forEach((id) => next.add(id));
      return Array.from(next);
    });
  }

  async function restoreSelected() {
    if (selectedIds.length === 0) {
      toast.info("Select trash items to restore");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/admin/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && !data.failures?.length) {
        throw new Error(data.error || "Failed to restore selected items");
      }

      if (data.restored?.length) {
        toast.success(
          data.restored.length === 1
            ? "Item restored"
            : `${data.restored.length} items restored`,
        );
      }
      if (data.failures?.length) {
        toast.error(
          data.failures.length === 1
            ? data.failures[0].error
            : `${data.failures.length} items could not be restored. ${data.failures[0].error}`,
        );
      }

      await loadTrash();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to restore selected items",
      );
    } finally {
      setBusy(false);
      setPendingAction(null);
    }
  }

  async function clearBin() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/trash", { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to clear bin");
      setItems([]);
      setSelectedIds([]);
      toast.success("Bin cleared");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to clear bin");
    } finally {
      setBusy(false);
      setPendingAction(null);
    }
  }

  async function confirmPendingAction() {
    if (pendingAction === "restore") {
      await restoreSelected();
      return;
    }
    if (pendingAction === "clear") {
      await clearBin();
    }
  }

  return (
    <div className="mx-auto w-full space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <img
              src="/trash/bin-closed.png"
              alt="Trash bin"
              className="h-12 w-12 object-contain"
            />
            Trash Bin
          </CardTitle>
          <CardDescription>
            Deleted items stay here for 7 days. Select items to restore them, or
            clear the bin permanently.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Deleted Items</CardTitle>
              <CardDescription>
                {items.length} item{items.length === 1 ? "" : "s"} in trash,{" "}
                {selectedIds.length} selected
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search trash..."
                  className="pl-9"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadTrash()}
                disabled={loading || busy}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Refresh
              </Button>
              <Button
                type="button"
                onClick={() => setPendingAction("restore")}
                disabled={selectedIds.length === 0 || busy}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Restore Selected
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setPendingAction("clear")}
                disabled={items.length === 0 || busy}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear Bin
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="mb-3 flex items-center gap-2">
            <Checkbox
              aria-label="Select all visible trash items"
              checked={
                allVisibleSelected
                  ? true
                  : someVisibleSelected
                    ? "indeterminate"
                    : false
              }
              onCheckedChange={(checked) => toggleVisible(checked === true)}
            />
            <span className="text-sm text-muted-foreground">
              Select visible
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24 text-muted-foreground">
              <Loader2 className="mr-2 h-6 w-6 animate-spin" />
              Loading trash...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded border border-dashed py-24 text-center text-sm text-muted-foreground">
              {items.length === 0
                ? "The bin is empty."
                : "No trash items match your search."}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => {
                const selected = selectedSet.has(item.id);
                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleItem(item.id, !selected)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggleItem(item.id, !selected);
                      }
                    }}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded border bg-background p-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selected && "border-primary bg-primary/10",
                    )}
                  >
                    <Checkbox
                      checked={selected}
                      onCheckedChange={(checked) =>
                        toggleItem(item.id, checked === true)
                      }
                      onClick={(event) => event.stopPropagation()}
                      aria-label={`Select ${item.label}`}
                    />
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded bg-muted">
                      {selected ? (
                        <Check className="h-5 w-5 text-primary" />
                      ) : (
                        <Trash2 className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="truncate font-semibold">
                            {item.label}
                          </div>
                          {item.description ? (
                            <div className="mt-1 text-sm text-muted-foreground">
                              {item.description}
                            </div>
                          ) : null}
                        </div>
                        <Badge variant="outline" className="w-fit shrink-0">
                          {item.entityType}
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>Deleted {formatDateTime(item.deletedAt)}</span>
                        {item.deletedByName ? (
                          <span>By {item.deletedByName}</span>
                        ) : null}
                        <span>
                          Auto clears {formatDateTime(item.expiresAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={pendingAction !== null}
        onOpenChange={(open) => !open && setPendingAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction === "restore"
                ? "Restore selected items?"
                : "Clear the trash bin?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction === "restore"
                ? `This will restore ${selectedIds.length} selected item${
                    selectedIds.length === 1 ? "" : "s"
                  } back to the live data. Items with conflicts will stay in trash.`
                : `This will permanently clear ${items.length} item${
                    items.length === 1 ? "" : "s"
                  } from the trash bin.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={pendingAction === "clear" ? "destructive" : "default"}
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                void confirmPendingAction();
              }}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {pendingAction === "restore" ? "Restore" : "Clear Bin"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
