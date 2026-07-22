"use client";
import { useCallback, useEffect, useState } from "react";
import { UploadDropzone } from "@/components/paint-planning/upload-dropzone";
import { SheetTable } from "@/components/paint-planning/sheet-table";
import type { TdsFile } from "@/types/tds-types";

export default function TechnicalDataSheetsPage() {
  const [files, setFiles] = useState<TdsFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ pageSize: "100" });
      if (search) qs.set("search", search);
      if (status) qs.set("status", status);
      const res = await fetch(`/api/admin/paint-tds?${qs}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Unable to load TDS imports.");
      setFiles(json.items);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to load imports.",
      );
    } finally {
      setLoading(false);
    }
  }, [search, status]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);
  return (
    <div className="mx-auto w-full px-6 py-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
            Product intelligence
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Technical Data Sheets</h1>
          <p className="mt-1 text-sm text-slate-500">
            Upload paint TDS PDFs, review extracted coverage profiles, then
            import them into Paint Planning.
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="rounded-md border bg-white px-4 py-2 text-sm"
        >
          Refresh
        </button>
      </div>
      <UploadDropzone onUploadComplete={load} />
      <div className="my-5 flex gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search file, product, code or manufacturer…"
          className="w-full max-w-md rounded-md border px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border bg-white px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="NEEDS_REVIEW">Needs review</option>
          <option value="IMPORTED">Imported</option>
          <option value="FAILED">Failed</option>
        </select>
      </div>
      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {loading ? (
        <div className="rounded-lg border bg-white p-10 text-center text-sm text-slate-500">
          Loading technical data sheets…
        </div>
      ) : (
        <SheetTable files={files} />
      )}
    </div>
  );
}
