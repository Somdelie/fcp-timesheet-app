"use client";

import * as React from "react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  Plus,
  Trash2,
  RotateCw,
  DollarSign,
  Pencil,
  Check,
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
import { Badge } from "@/components/ui/badge";
import { ConfirmationDialog } from "@/components/common/ConfirmationDialog";
import { formatCurrency } from "@/lib/formatCurrency";

/* ─── Types ─── */

type OvertimePrice = {
  id: string;
  label: string;
  rate: number;
  isActive: boolean;
  createdAt: string;
};

/* ─── Component ─── */

export default function OvertimePricesPage() {
  const [prices, setPrices] = useState<OvertimePrice[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form
  const [newLabel, setNewLabel] = useState("");
  const [newRate, setNewRate] = useState("");
  const [creating, setCreating] = useState(false);

  // Inline edit
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editRate, setEditRate] = useState("");

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);

  /* ── Load ── */
  const loadPrices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        "/api/app/admin/overtime-prices?includeInactive=true",
        { credentials: "include", headers: { accept: "application/json" } },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to load");
      setPrices(json?.data ?? []);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load overtime prices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPrices();
  }, [loadPrices]);

  /* ── Create ── */
  async function handleCreate() {
    if (!newLabel.trim()) {
      toast.error("Enter a label");
      return;
    }
    if (!newRate || isNaN(Number(newRate)) || Number(newRate) < 0) {
      toast.error("Enter a valid rate");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/app/admin/overtime-prices", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({ label: newLabel.trim(), rate: Number(newRate) }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to create");
      toast.success("Overtime price created");
      setNewLabel("");
      setNewRate("");
      loadPrices();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create");
    } finally {
      setCreating(false);
    }
  }

  /* ── Update ── */
  async function handleUpdate() {
    if (!editId) return;
    try {
      const res = await fetch(`/api/app/admin/overtime-prices/${editId}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          label: editLabel.trim(),
          rate: Number(editRate),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to update");
      toast.success("Updated");
      setEditId(null);
      loadPrices();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update");
    }
  }

  /* ── Toggle active ── */
  async function toggleActive(id: string, current: boolean) {
    try {
      const res = await fetch(`/api/app/admin/overtime-prices/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({ isActive: !current }),
      });
      if (!res.ok) throw new Error("Failed");
      loadPrices();
    } catch {
      toast.error("Failed to toggle status");
    }
  }

  /* ── Delete ── */
  async function handleDelete() {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/app/admin/overtime-prices/${deleteId}`, {
        method: "DELETE",
        credentials: "include",
        headers: { accept: "application/json" },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to delete");
      toast.success(json?.message ?? "Deleted");
      setDeleteId(null);
      loadPrices();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete");
    }
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overtime Prices</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage hourly overtime rates. These prices are used when creating
          overtime entries.
        </p>
      </div>

      {/* Create form */}
      <div className="border rounded bg-card p-4">
        <h3 className="text-sm font-semibold mb-3">Add New Price</h3>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-45">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Label
            </label>
            <Input
              placeholder="e.g. Weekend OT, Night OT"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
            />
          </div>
          <div className="w-40">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Rate (R/hr)
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={newRate}
              onChange={(e) => setNewRate(e.target.value)}
            />
          </div>
          <Button onClick={handleCreate} disabled={creating}>
            <Plus className="mr-2 h-4 w-4" />
            {creating ? "Creating..." : "Add Price"}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="border bg-card rounded overflow-hidden">
        <div className="p-3 border-b flex items-center justify-between">
          <span className="text-sm font-medium">
            {prices.length} overtime price{prices.length !== 1 ? "s" : ""}
          </span>
          <Button variant="outline" size="sm" onClick={loadPrices}>
            <RotateCw className="h-3.5 w-3.5 mr-1" />
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-muted-foreground">
            Loading...
          </div>
        ) : prices.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <DollarSign className="mx-auto h-10 w-10 mb-2 opacity-30" />
            No overtime prices yet. Add one above.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead className="text-right">Rate (R/hr)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prices.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    {editId === p.id ? (
                      <Input
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        className="h-8 w-full max-w-50"
                      />
                    ) : (
                      <span className="font-medium">{p.label}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {editId === p.id ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={editRate}
                        onChange={(e) => setEditRate(e.target.value)}
                        className="h-8 w-28 ml-auto"
                      />
                    ) : (
                      formatCurrency(p.rate)
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={p.isActive ? "default" : "secondary"}
                      className="cursor-pointer"
                      onClick={() => toggleActive(p.id, p.isActive)}
                    >
                      {p.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {editId === p.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleUpdate}
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditId(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditId(p.id);
                            setEditLabel(p.label);
                            setEditRate(String(p.rate));
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(p.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Delete Confirmation */}
      <ConfirmationDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title="Delete Overtime Price"
        description="Are you sure? If this price is used by overtime entries it will be deactivated instead."
        confirmText="Delete"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  );
}
