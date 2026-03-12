"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
  Building2,
  Hash,
  User,
  CalendarDays,
  Layers,
  ListChecks,
  Pencil,
  FileDown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

// ── Types ────────────────────────────────────────────────────────────────────

export type ScheduleRow = {
  id: string;
  contractNo: string | null;
  client: string | null;
  contractManager: string | null;
  startDate: string | null;
  completionDate: string | null;
  site: { id: string; name: string; code: string | null };
  areaCount: number;
  itemCount: number;
};

interface Props {
  data: ScheduleRow[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function classNames(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

// ── Sortable header helper ───────────────────────────────────────────────────

function SortableHeader({
  column,
  icon: Icon,
  iconColor,
  label,
}: {
  column: any;
  icon: React.ElementType;
  iconColor: string;
  label: string;
}) {
  const isSorted = column.getIsSorted();
  return (
    <button
      className="flex items-center gap-1 hover:text-foreground transition-colors"
      onClick={() => column.toggleSorting(isSorted === "asc")}
    >
      <Icon className={`h-4 w-4 ${iconColor}`} />
      {label}
      {isSorted === "asc" ? (
        <ChevronUp className="h-4 w-4" />
      ) : isSorted === "desc" ? (
        <ChevronDown className="h-4 w-4" />
      ) : (
        <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
      )}
    </button>
  );
}

// ── Row Actions ──────────────────────────────────────────────────────────────

function RowActions({ schedule }: { schedule: ScheduleRow }) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Row actions">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          className="flex items-center gap-2"
          onSelect={(e) => {
            e.preventDefault();
            router.push(`/admin/finishing-schedules/${schedule.id}`);
          }}
        >
          <Pencil className="h-4 w-4" />
          Open Builder
        </DropdownMenuItem>
        <DropdownMenuItem
          className="flex items-center gap-2"
          onSelect={() => {
            window.open(
              `/api/finishing-schedules/${encodeURIComponent(schedule.id)}/pdf`,
              "_blank",
            );
          }}
        >
          <FileDown className="h-4 w-4" />
          Download PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Table Component ──────────────────────────────────────────────────────────

export default function FinishingSchedulesTable({ data }: Props) {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "site", desc: false },
  ]);
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  });

  const columns: ColumnDef<ScheduleRow>[] = React.useMemo(
    () => [
      {
        id: "site",
        accessorFn: (row) => row.site.name,
        header: ({ column }) => (
          <SortableHeader
            column={column}
            icon={Building2}
            iconColor="text-sky-600"
            label="Site"
          />
        ),
        cell: ({ row }) => (
          <Link
            href={`/sites/${row.original.site.id}`}
            className="text-primary hover:underline font-semibold uppercase"
          >
            {row.original.site.name}
            {row.original.site.code && (
              <Badge variant="outline" className="ml-2 text-xs">
                {row.original.site.code}
              </Badge>
            )}
          </Link>
        ),
      },
      {
        id: "contractNo",
        accessorKey: "contractNo",
        size: 130,
        header: ({ column }) => (
          <SortableHeader
            column={column}
            icon={Hash}
            iconColor="text-indigo-600"
            label="Contract No"
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.contractNo ?? "—"}
          </span>
        ),
      },
      {
        id: "client",
        accessorKey: "client",
        size: 150,
        header: ({ column }) => (
          <SortableHeader
            column={column}
            icon={User}
            iconColor="text-amber-600"
            label="Client"
          />
        ),
        cell: ({ row }) => (
          <span className="text-sm">{row.original.client ?? "—"}</span>
        ),
      },
      {
        id: "contractManager",
        accessorKey: "contractManager",
        size: 160,
        header: ({ column }) => (
          <SortableHeader
            column={column}
            icon={User}
            iconColor="text-violet-600"
            label="Contract Manager"
          />
        ),
        cell: ({ row }) => (
          <span className="text-sm">{row.original.contractManager ?? "—"}</span>
        ),
      },
      {
        id: "areaCount",
        accessorKey: "areaCount",
        size: 90,
        header: () => (
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-teal-600" />
            Areas
          </div>
        ),
        cell: ({ row }) => (
          <span className="block text-center text-sm">
            {row.original.areaCount}
          </span>
        ),
      },
      {
        id: "itemCount",
        accessorKey: "itemCount",
        size: 90,
        header: () => (
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-emerald-600" />
            Items
          </div>
        ),
        cell: ({ row }) => (
          <span className="block text-center text-sm">
            {row.original.itemCount}
          </span>
        ),
      },
      {
        id: "startDate",
        accessorKey: "startDate",
        size: 120,
        header: ({ column }) => (
          <SortableHeader
            column={column}
            icon={CalendarDays}
            iconColor="text-rose-600"
            label="Start"
          />
        ),
        cell: ({ row }) => (
          <span className="text-sm">{formatDate(row.original.startDate)}</span>
        ),
      },
      {
        id: "completionDate",
        accessorKey: "completionDate",
        size: 120,
        header: ({ column }) => (
          <SortableHeader
            column={column}
            icon={CalendarDays}
            iconColor="text-green-600"
            label="Completion"
          />
        ),
        cell: ({ row }) => (
          <span className="text-sm">
            {formatDate(row.original.completionDate)}
          </span>
        ),
      },
      {
        id: "actions",
        size: 80,
        header: () => <div className="text-center">Actions</div>,
        cell: ({ row }) => (
          <div className="text-center">
            <RowActions schedule={row.original} />
          </div>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="border bg-card">
      <div className="overflow-x-auto">
        <Table className="border-collapse">
          <TableHeader className="bg-muted/60">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{ width: header.column.getSize() }}
                    className="border border-zinc-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide dark:border-zinc-700"
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
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      style={{ width: cell.column.getSize() }}
                      className="border border-zinc-200 px-3 py-1 dark:border-zinc-700"
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
                  No finishing schedules yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between border-t px-4 py-3 bg-muted/60">
        <div className="text-muted-foreground hidden text-sm lg:flex">
          Showing{" "}
          {data.length === 0
            ? 0
            : table.getState().pagination.pageIndex *
                table.getState().pagination.pageSize +
              1}{" "}
          to{" "}
          {Math.min(
            (table.getState().pagination.pageIndex + 1) *
              table.getState().pagination.pageSize,
            data.length,
          )}{" "}
          of {data.length} schedules
        </div>
        <div className="flex w-full items-center gap-4 lg:w-fit lg:gap-8">
          <div className="hidden items-center gap-2 lg:flex">
            <span className="text-sm font-medium">Rows per page</span>
            <Select
              value={String(table.getState().pagination.pageSize)}
              onValueChange={(value) => table.setPageSize(Number(value))}
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
