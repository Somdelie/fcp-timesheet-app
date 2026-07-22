"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  FileText,
  Trash2,
} from "lucide-react";

import type { TdsFile } from "@/types/tds-types";

interface SheetTableProps {
  files: TdsFile[];
  onDeleted?: () => Promise<void> | void;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50];

const PROCESSING_STATUSES: TdsFile["status"][] = [
  "uploaded",
  "extracting",
  "parsing",
];

function isProcessing(status: TdsFile["status"]) {
  return PROCESSING_STATUSES.includes(status);
}

function getStatusClasses(status: TdsFile["status"]) {
  switch (status) {
    case "imported":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "needs-review":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "failed":
      return "border-red-200 bg-red-50 text-red-700";

    case "uploaded":
    case "extracting":
    case "parsing":
      return "border-blue-200 bg-blue-50 text-blue-700";

    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export function SheetTable({ files, onDeleted }: SheetTableProps) {
  const router = useRouter();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(files.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const paginatedFiles = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return files.slice(start, start + pageSize);
  }, [files, currentPage, pageSize]);

  const firstVisibleRow =
    files.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;

  const lastVisibleRow = Math.min(currentPage * pageSize, files.length);

  function changePageSize(value: number) {
    setPageSize(value);
    setPage(1);
  }

  function openFile(file: TdsFile) {
    if (isProcessing(file.status)) return;

    router.push(`/admin/technical-data-sheets/${file.id}`);
  }

  async function deleteFile(file: TdsFile) {
    const confirmed = window.confirm(
      `Delete "${file.fileName}"?\n\nThis will permanently remove the import and all extracted coverage profiles.`,
    );

    if (!confirmed) return;

    setDeletingId(file.id);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/admin/paint-tds/${file.id}`, {
        method: "DELETE",
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error ?? "Unable to delete the data sheet.");
      }

      await onDeleted?.();

      const remainingItems = files.length - 1;
      const newTotalPages = Math.max(1, Math.ceil(remainingItems / pageSize));

      setPage((current) => Math.min(current, newTotalPages));
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : "Unable to delete the data sheet.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  if (!files.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <FileText size={20} />
        </div>

        <p className="mt-4 text-sm font-semibold text-slate-800">
          No technical data sheets
        </p>

        <p className="mt-1 text-sm text-slate-500">
          Upload one or more PDF data sheets to begin extracting product
          information.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {deleteError && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {deleteError}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-312.5 table-fixed border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50">
            <tr>
              <HeaderCell className="w-70">File</HeaderCell>
              <HeaderCell className="w-37.5">Manufacturer</HeaderCell>
              <HeaderCell className="w-55">Product</HeaderCell>
              <HeaderCell className="w-32.5">Code</HeaderCell>
              <HeaderCell className="w-25">Revision</HeaderCell>
              <HeaderCell className="w-22.5 text-center">Profiles</HeaderCell>
              <HeaderCell className="w-57.5">Status</HeaderCell>
              <HeaderCell className="w-42.5">Uploaded</HeaderCell>
              <HeaderCell className="w-22.5 text-center">Actions</HeaderCell>
            </tr>
          </thead>

          <tbody>
            {paginatedFiles.map((file) => {
              const disabled = isProcessing(file.status);
              const deleting = deletingId === file.id;

              return (
                <tr
                  key={file.id}
                  tabIndex={disabled ? -1 : 0}
                  onClick={() => openFile(file)}
                  onKeyDown={(event) => {
                    if (
                      !disabled &&
                      (event.key === "Enter" || event.key === " ")
                    ) {
                      event.preventDefault();
                      openFile(file);
                    }
                  }}
                  className={[
                    "group transition-colors",
                    disabled
                      ? "cursor-default bg-slate-50/40 text-slate-500"
                      : "cursor-pointer hover:bg-emerald-50/50 focus:bg-emerald-50/50 focus:outline-none",
                  ].join(" ")}
                >
                  <BodyCell>
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-red-50 text-red-600">
                        <FileText size={16} />
                      </span>

                      <div className="min-w-0">
                        <p
                          title={file.fileName}
                          className="truncate font-mono text-xs font-medium text-slate-800"
                        >
                          {file.fileName}
                        </p>

                        <p className="mt-0.5 text-[11px] text-slate-400">
                          PDF technical data sheet
                        </p>
                      </div>
                    </div>
                  </BodyCell>

                  <BodyCell>
                    <span className="block truncate">
                      {file.manufacturer ?? "—"}
                    </span>
                  </BodyCell>

                  <BodyCell>
                    <span
                      title={file.productName ?? undefined}
                      className="block truncate font-medium text-slate-800"
                    >
                      {file.productName ?? (disabled ? "Reading…" : "—")}
                    </span>
                  </BodyCell>

                  <BodyCell>
                    <span className="block truncate font-mono text-xs">
                      {file.productCode ?? "—"}
                    </span>
                  </BodyCell>

                  <BodyCell>{file.revision ?? "—"}</BodyCell>

                  <BodyCell className="text-center">
                    <span className="inline-flex min-w-7 items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
                      {file.profiles.length}
                    </span>
                  </BodyCell>

                  <BodyCell>
                    <div className="min-w-0">
                      <span
                        className={[
                          "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium capitalize",
                          getStatusClasses(file.status),
                        ].join(" ")}
                      >
                        {file.status.replaceAll("-", " ")}
                      </span>

                      {file.errorMessage && (
                        <p
                          title={file.errorMessage}
                          className="mt-1.5 line-clamp-2 text-xs leading-4 text-red-600"
                        >
                          {file.errorMessage}
                        </p>
                      )}
                    </div>
                  </BodyCell>

                  <BodyCell>
                    <div className="text-xs text-slate-500">
                      <p>
                        {new Date(file.uploadedAt).toLocaleDateString("en-ZA", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </p>

                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {new Date(file.uploadedAt).toLocaleTimeString("en-ZA", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </BodyCell>

                  <BodyCell className="text-center">
                    <button
                      type="button"
                      title="Delete technical data sheet"
                      aria-label={`Delete ${file.fileName}`}
                      disabled={deleting}
                      onClick={(event) => {
                        event.stopPropagation();
                        void deleteFile(file);
                      }}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-red-200 bg-white text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </BodyCell>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-4 border-t border-slate-200 bg-slate-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500 sm:text-sm">
          Showing{" "}
          <span className="font-medium text-slate-700">{firstVisibleRow}</span>{" "}
          to{" "}
          <span className="font-medium text-slate-700">{lastVisibleRow}</span>{" "}
          of <span className="font-medium text-slate-700">{files.length}</span>{" "}
          sheets
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-500 sm:text-sm">
            Rows per page
            <select
              value={pageSize}
              onChange={(event) => changePageSize(Number(event.target.value))}
              className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <span className="min-w-20 text-center text-xs font-medium text-slate-600 sm:text-sm">
            Page {currentPage} of {totalPages}
          </span>

          <div className="flex items-center gap-1">
            <PaginationButton
              label="First page"
              disabled={currentPage === 1}
              onClick={() => setPage(1)}
            >
              <ChevronFirst size={16} />
            </PaginationButton>

            <PaginationButton
              label="Previous page"
              disabled={currentPage === 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              <ChevronLeft size={16} />
            </PaginationButton>

            <PaginationButton
              label="Next page"
              disabled={currentPage === totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            >
              <ChevronRight size={16} />
            </PaginationButton>

            <PaginationButton
              label="Last page"
              disabled={currentPage === totalPages}
              onClick={() => setPage(totalPages)}
            >
              <ChevronLast size={16} />
            </PaginationButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeaderCell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={[
        "border-b border-r border-slate-200 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 last:border-r-0",
        className,
      ].join(" ")}
    >
      {children}
    </th>
  );
}

function BodyCell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td
      className={[
        "border-b border-r border-slate-200 px-4 py-3.5 align-middle text-slate-600 last:border-r-0",
        className,
      ].join(" ")}
    >
      {children}
    </td>
  );
}

function PaginationButton({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-300"
    >
      {children}
    </button>
  );
}
