"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "react-toastify";
import {
  RotateCw,
  Package,
  User2,
  ChevronDown,
  ChevronRight,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type EquipmentHolder = { id: string; name: string };
type EquipmentItem = {
  id: string;
  holderId: string | null;
  holder: EquipmentHolder | null;
  category: string;
  item: string;
  quantity: number;
  condition: string;
  notes: string | null;
  location: string | null;
};

const CONDITION_COLORS: Record<string, string> = {
  Good: "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Needs Service": "bg-amber-100 text-amber-700 border-amber-200",
  "Beyond Repair": "bg-red-100 text-red-700 border-red-200",
  Stolen: "bg-slate-100 text-slate-600 border-slate-200",
};

const CONDITIONS = [
  "Good",
  "Needs Service",
  "Beyond Repair",
  "Stolen",
] as const;

export default function EquipmentInventoryPage() {
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [holders, setHolders] = useState<EquipmentHolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedHolders, setExpandedHolders] = useState<Set<string>>(
    new Set(["__all__"]),
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/app/admin/equipment-inventory");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setItems(data.items);
      setHolders(data.holders);
      setExpandedHolders(
        new Set(["__all__", ...data.holders.map((h: EquipmentHolder) => h.id)]),
      );
    } catch {
      toast.error("Failed to load equipment inventory");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (i) =>
        i.item.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        i.holder?.name.toLowerCase().includes(q),
    );
  }, [items, search]);

  const companyTotals = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const i of filteredItems) {
      if (!map.has(i.category)) map.set(i.category, new Map());
      const condMap = map.get(i.category)!;
      condMap.set(i.condition, (condMap.get(i.condition) ?? 0) + i.quantity);
    }
    return Array.from(map.entries()).map(([category, condMap]) => ({
      category,
      total: Array.from(condMap.values()).reduce((s, v) => s + v, 0),
      byCondition: condMap,
    }));
  }, [filteredItems]);

  const holderGroups = useMemo(() => {
    const map = new Map<
      string,
      { holder: EquipmentHolder | null; items: EquipmentItem[] }
    >();
    for (const holder of holders) {
      map.set(holder.id, { holder, items: [] });
    }
    map.set("__unassigned__", { holder: null, items: [] });

    for (const item of filteredItems) {
      const key = item.holderId ?? "__unassigned__";
      if (!map.has(key)) map.set(key, { holder: item.holder, items: [] });
      map.get(key)!.items.push(item);
    }

    return Array.from(map.values()).filter((g) => g.items.length > 0);
  }, [filteredItems, holders]);

  const toggleHolder = (id: string) => {
    setExpandedHolders((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalFiltered = filteredItems.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div className="flex gap-4 items-center">
          <div className="p-3 bg-blue-50 rounded-xl shadow-sm">
            <Package className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Equipment Inventory
            </h1>
            <p className="text-sm text-slate-500">
              {loading
                ? "Loading..."
                : `${totalItems} items • ${holders.length} holders`}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-9 h-10 w-64 rounded-xl"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-2.5"
              >
                <X className="h-4 w-4 text-slate-400" />
              </button>
            )}
          </div>

          <Button onClick={fetchData} variant="outline" size="icon">
            <RotateCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* COMPANY TOTALS */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
        <button
          onClick={() => toggleHolder("__all__")}
          className="w-full flex justify-between px-4 py-3 hover:bg-slate-50"
        >
          <div className="flex gap-2 items-center">
            {expandedHolders.has("__all__") ? (
              <ChevronDown />
            ) : (
              <ChevronRight />
            )}
            <span className="font-medium">Company Totals</span>
          </div>
          <Badge>{companyTotals.length}</Badge>
        </button>

        {expandedHolders.has("__all__") && (
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-2">Category</th>
                {CONDITIONS.map((c) => (
                  <th key={c} className="text-center">
                    {c}
                  </th>
                ))}
                <th className="text-right px-4">Total</th>
              </tr>
            </thead>

            <tbody>
              {companyTotals.map((row) => (
                <tr key={row.category} className="hover:bg-slate-50">
                  <td className="px-4 py-2">{row.category}</td>
                  {CONDITIONS.map((c) => (
                    <td key={c} className="text-center">
                      {row.byCondition.get(c) ?? "-"}
                    </td>
                  ))}
                  <td className="text-right px-4 font-semibold">{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* HOLDERS */}
      <div className="space-y-4">
        {holderGroups.map((group) => {
          const id = group.holder?.id ?? "__unassigned__";
          const isExpanded = expandedHolders.has(id);

          return (
            <div key={id} className="bg-white rounded-xl border">
              <button
                onClick={() => toggleHolder(id)}
                className="w-full flex justify-between px-4 py-3 hover:bg-slate-50"
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? <ChevronDown /> : <ChevronRight />}
                  <User2 className="h-4 w-4" />
                  {group.holder?.name ?? "Unassigned"}
                </div>

                <Badge>{group.items.length}</Badge>
              </button>

              {isExpanded && (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-4 py-2">Item</th>
                      <th className="text-center">Qty</th>
                      <th className="text-left">Condition</th>
                    </tr>
                  </thead>

                  <tbody>
                    {group.items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2">{item.item}</td>
                        <td className="text-center">{item.quantity}</td>
                        <td>
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full text-xs border",
                              CONDITION_COLORS[item.condition],
                            )}
                          >
                            {item.condition}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
