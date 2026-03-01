"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
} from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CalendarDays,
  BadgeDollarSign,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Loader2,
  Phone,
} from "lucide-react";
import EmployeeRowActions from "@/components/employees/EmployeeRowActions";

export type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  qrCodeValue: string;
  defaultDayRate: string | null;
  faceImageUrl: string | null;
  isActive: boolean;
  createdAt: string;
  phone?: string | null;
  createdByRole?: string | null;
  createdByUserId?: string | null;
  createdByUserName?: string | null;
  userId?: string | null;
  linkedToForemanId?: string | null;
  isForeman?: boolean;
};

function formatMoneyString(s: string) {
  const n = Number(String(s).replace(",", "."));
  if (!Number.isFinite(n)) return `R ${s}`;
  return `R ${n.toFixed(2)}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

/** Sanitise a string for use in a filename */
function safeFilename(first: string, last: string) {
  return `${first}_${last}`.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_");
}

/**
 * Download a single employee card PDF via fetch and return the blob + suggested name.
 */
async function fetchCardBlob(
  emp: Employee,
): Promise<{ blob: Blob; name: string }> {
  const res = await fetch(`/api/employees/${emp.id}/card.pdf`);
  if (!res.ok)
    throw new Error(
      `Failed to download card for ${emp.firstName} ${emp.lastName}`,
    );
  const blob = await res.blob();
  return {
    blob,
    name: `${safeFilename(emp.firstName, emp.lastName)}_Card.pdf`,
  };
}

/**
 * Prompt the user to pick a folder (File System Access API).
 * Returns the directory handle, or null if unsupported / cancelled.
 */
async function pickDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (typeof window === "undefined") return null;
  if (!("showDirectoryPicker" in window)) return null;
  try {
    return await (window as any).showDirectoryPicker({ mode: "readwrite" });
  } catch {
    // User cancelled the picker
    return null;
  }
}

/**
 * Save a blob to the chosen directory handle.
 */
async function saveBlobToDirectory(
  dirHandle: FileSystemDirectoryHandle,
  filename: string,
  blob: Blob,
) {
  const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
  const writable = await (fileHandle as any).createWritable();
  await writable.write(blob);
  await writable.close();
}

/**
 * Fallback: trigger a normal browser download for a blob.
 */
function downloadBlobFallback(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const columns: ColumnDef<Employee>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      </div>
    ),
    enableSorting: false,
  },
  {
    id: "employee",
    accessorFn: (row) => `${row.firstName} ${row.lastName}`,
    header: ({ column }) => {
      const isSorted = column.getIsSorted();
      return (
        <button
          className="flex items-center gap-1 hover:text-foreground transition-colors"
          onClick={() => column.toggleSorting(isSorted === "asc")}
        >
          Employee
          {isSorted === "asc" ? (
            <ChevronUp className="h-4 w-4" />
          ) : isSorted === "desc" ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      );
    },
    cell: ({ row }) => {
      const e = row.original;
      return (
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 overflow-hidden border border-zinc-200 bg-primary text-white dark:border-zinc-700">
            {e.faceImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={e.faceImageUrl}
                alt={`${e.firstName} ${e.lastName}`}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-white">
                {e.firstName?.[0]}
                {e.lastName?.[0]}
              </div>
            )}
          </div>
          <div className="min-w-0 flex items-center w-full justify-between">
            <div className="truncate font-medium">
              {e.firstName} {e.lastName}
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {e.linkedToForemanId && (
                <Badge
                  variant="secondary"
                  className="text-[11px] bg-orange-700/20 text-orange-700 dark:bg-orange-300/20 dark:text-orange-300"
                >
                  Assistant
                </Badge>
              )}
              {!e.linkedToForemanId && e.isForeman && (
                <Badge variant="default" className="text-[11px]">
                  Foreman
                </Badge>
              )}
              {!e.linkedToForemanId && !e.isForeman && (
                <Badge variant="secondary" className="text-[11px]">
                  Individual
                </Badge>
              )}
              {!e.isActive && (
                <Badge variant="destructive" className="text-[11px]">
                  Inactive
                </Badge>
              )}
            </div>
          </div>
        </div>
      );
    },
  },
  {
    id: "phone",
    accessorKey: "phone",
    header: () => (
      <div className="flex items-center gap-2">
        <Phone className="h-4 w-4 text-violet-600" />
        Phone
      </div>
    ),
    cell: ({ row }) => (
      <span className="text-sm">{row.original.phone || "\u2014"}</span>
    ),
  },
  {
    id: "dayRate",
    accessorKey: "defaultDayRate",
    header: () => (
      <div className="flex items-center gap-2">
        <BadgeDollarSign className="h-4 w-4 text-sky-600" />
        Day rate
      </div>
    ),
    cell: ({ row }) => (
      <span className="text-sm">
        {row.original.defaultDayRate
          ? formatMoneyString(row.original.defaultDayRate)
          : "Company default"}
      </span>
    ),
  },
  {
    id: "qrCode",
    accessorKey: "qrCodeValue",
    header: "QR code",
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.original.qrCodeValue}</span>
    ),
  },
  {
    id: "createdAt",
    accessorKey: "createdAt",
    header: ({ column }) => {
      const isSorted = column.getIsSorted();
      return (
        <button
          className="flex items-center gap-1 hover:text-foreground transition-colors"
          onClick={() => column.toggleSorting(isSorted === "asc")}
        >
          <CalendarDays className="h-4 w-4 text-emerald-600" />
          Added
          {isSorted === "asc" ? (
            <ChevronUp className="h-4 w-4" />
          ) : isSorted === "desc" ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      );
    },
    cell: ({ row }) => (
      <span className="text-xs">{formatDate(row.original.createdAt)}</span>
    ),
  },
  {
    id: "actions",
    header: () => <div className="text-center">Actions</div>,
    cell: ({ row }) => (
      <div className="text-center">
        <EmployeeRowActions
          id={row.original.id}
          firstName={row.original.firstName}
          lastName={row.original.lastName}
          qrCodeValue={row.original.qrCodeValue}
          isActive={row.original.isActive}
        />
      </div>
    ),
  },
];

export default function EmployeesTable({ data }: { data: Employee[] }) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  });
  const [downloading, setDownloading] = React.useState(false);
  const [dlProgress, setDlProgress] = React.useState({ done: 0, total: 0 });

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      pagination,
      rowSelection,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableRowSelection: true,
  });

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedCount = selectedRows.length;

  /** Download selected employee cards – lets user pick a folder first */
  const handleBulkDownload = React.useCallback(async () => {
    if (selectedCount === 0) return;
    setDownloading(true);
    setDlProgress({ done: 0, total: selectedCount });

    const employees = selectedRows.map((r) => r.original);

    // Try to let the user pick a save folder
    const dirHandle = await pickDirectory();

    const errors: string[] = [];

    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];
      try {
        const { blob, name } = await fetchCardBlob(emp);
        if (dirHandle) {
          await saveBlobToDirectory(dirHandle, name, blob);
        } else {
          // Fallback: normal browser download
          downloadBlobFallback(blob, name);
        }
      } catch (err: any) {
        errors.push(`${emp.firstName} ${emp.lastName}: ${err.message}`);
      }
      setDlProgress({ done: i + 1, total: employees.length });
    }

    setDownloading(false);
    if (errors.length > 0) {
      alert(`Some cards failed to download:\n${errors.join("\n")}`);
    }
  }, [selectedRows, selectedCount]);

  return (
    <div className="border bg-card">
      {/* Bulk-actions toolbar */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-3 border-b bg-muted/40 px-4 py-2">
          <span className="text-sm font-medium">
            {selectedCount} employee{selectedCount !== 1 ? "s" : ""} selected
          </span>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={downloading}
            onClick={handleBulkDownload}
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {downloading
              ? `Downloading ${dlProgress.done}/${dlProgress.total}…`
              : `Download ${selectedCount} Card${selectedCount !== 1 ? "s" : ""}`}
          </Button>
          {downloading && (
            <Progress
              value={(dlProgress.done / dlProgress.total) * 100}
              className="h-2 w-32"
            />
          )}
          <Button size="sm" variant="ghost" onClick={() => setRowSelection({})}>
            Clear selection
          </Button>
        </div>
      )}
      <div className="overflow-x-auto">
        <Table className="border-collapse">
          <TableHeader className="bg-muted/60">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="border border-zinc-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide dark:border-zinc-700"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={`hover:bg-zinc-50 dark:hover:bg-zinc-900/40 ${
                    (row.original as Employee).isForeman
                      ? "bg-sky-50/60 dark:bg-sky-900/30"
                      : ""
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="border border-zinc-200 px-3 py-2 dark:border-zinc-700"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between border-t px-4 py-3 bg-muted/60">
        <div className="text-muted-foreground hidden text-sm lg:flex gap-2">
          <span>
            Showing{" "}
            {table.getState().pagination.pageIndex *
              table.getState().pagination.pageSize +
              1}{" "}
            to{" "}
            {Math.min(
              (table.getState().pagination.pageIndex + 1) *
                table.getState().pagination.pageSize,
              data.length,
            )}{" "}
            of {data.length} employees
          </span>
          {selectedCount > 0 && (
            <span className="text-primary font-medium">
              ({selectedCount} selected)
            </span>
          )}
        </div>
        <div className="flex w-full items-center gap-4 lg:w-fit lg:gap-8">
          <div className="hidden items-center gap-2 lg:flex">
            <span className="text-sm font-medium">Rows per page</span>
            <Select
              value={String(table.getState().pagination.pageSize)}
              onValueChange={(value) => {
                table.setPageSize(Number(value));
              }}
            >
              <SelectTrigger className="h-8 w-20">
                <SelectValue
                  placeholder={table.getState().pagination.pageSize}
                />
              </SelectTrigger>
              <SelectContent side="top">
                {[5, 10, 25, 50, 100].map((pageSize) => (
                  <SelectItem key={pageSize} value={String(pageSize)}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-fit items-center justify-center text-sm font-medium">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount() || 1}
          </div>
          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <Button
              variant="outline"
              size="icon"
              className="hidden h-8 w-8 lg:flex"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to first page</span>
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to previous page</span>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to next page</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="hidden h-8 w-8 lg:flex"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to last page</span>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
