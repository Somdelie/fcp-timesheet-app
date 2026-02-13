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
} from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
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
  CalendarDays,
  BadgeDollarSign,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
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
  createdByRole?: string | null;
  userId?: string | null;
  linkedToForemanId?: string | null;
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

const columns: ColumnDef<Employee>[] = [
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
              {!e.linkedToForemanId &&
                (e.createdByRole === "FOREMAN" || e.userId) && (
                  <Badge variant="default" className="text-[11px]">
                    Foreman
                  </Badge>
                )}
              {!e.linkedToForemanId &&
                e.createdByRole !== "FOREMAN" &&
                !e.userId && (
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
          qrCodeValue={row.original.qrCodeValue}
          isActive={row.original.isActive}
        />
      </div>
    ),
  },
];

export default function EmployeesTable({ data }: { data: Employee[] }) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  });

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      pagination,
    },
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
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
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
        <div className="text-muted-foreground hidden text-sm lg:flex">
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
