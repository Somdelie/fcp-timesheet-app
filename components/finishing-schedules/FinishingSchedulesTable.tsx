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
  type Column,
  type ColumnDef,
  type RowSelectionState,
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
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "react-toastify";

import { deleteFinishingSchedule } from "@/actions/site-finishing-schedule";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
  site: {
    id: string;
    name: string;
    code: string | null;
    supervisorName?: string | null;
  };
  areaCount: number;
  itemCount: number;
};

interface Props {
  data: ScheduleRow[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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
  column: Column<ScheduleRow, unknown>;
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

function RowActions({
  schedule,
  onDeleted,
}: {
  schedule: ScheduleRow;
  onDeleted: (id: string) => void;
}) {
  const router = useRouter();
  const [deleting, startDeleteTransition] = React.useTransition();

  function handleDelete() {
    const label = schedule.site.code
      ? `${schedule.site.code} - ${schedule.site.name}`
      : schedule.site.name;
    if (!window.confirm(`Delete finishing schedule for ${label}?`)) return;

    startDeleteTransition(async () => {
      const res = await deleteFinishingSchedule(schedule.id);
      if (!res.ok) {
        toast.error(res.error ?? "Failed to delete schedule.");
        return;
      }
      toast.success("Finishing schedule deleted.");
      onDeleted(schedule.id);
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label="Row actions"
          disabled={deleting}
        >
          {deleting ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <MoreHorizontal className="h-4 w-4" />
          )}
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
        <DropdownMenuItem
          className="flex items-center gap-2 text-destructive focus:text-destructive"
          onSelect={(e) => {
            e.preventDefault();
            handleDelete();
          }}
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Table Component ──────────────────────────────────────────────────────────

export default function FinishingSchedulesTable({ data }: Props) {
  const router = useRouter();
  const [rows, setRows] = React.useState(data);
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "contractNo", desc: true },
  ]);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [search, setSearch] = React.useState("");
  const [supervisorFilter, setSupervisorFilter] = React.useState("all");
  const [bulkDeleting, startBulkDeleteTransition] = React.useTransition();
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  });

  React.useEffect(() => {
    setRows(data);
    setRowSelection({});
  }, [data]);

  const supervisors = React.useMemo(() => {
    const names = new Set<string>();
    for (const row of rows) {
      const name = row.site.supervisorName?.trim();
      if (name) names.add(name);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredRows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const supervisor = row.site.supervisorName?.trim() ?? "";
      if (supervisorFilter !== "all" && supervisor !== supervisorFilter) {
        return false;
      }
      if (!q) return true;
      return (
        row.site.name.toLowerCase().includes(q) ||
        (row.site.code ?? "").toLowerCase().includes(q) ||
        (row.contractNo ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, supervisorFilter]);

  const selectedRows = React.useMemo(
    () =>
      Object.entries(rowSelection)
        .filter(([, selected]) => selected)
        .map(([id]) => filteredRows.find((row) => row.id === id))
        .filter((row): row is ScheduleRow => Boolean(row)),
    [filteredRows, rowSelection],
  );

  function handleDeleted(id: string) {
    setRows((prev) => prev.filter((row) => row.id !== id));
    setRowSelection((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function handleBulkDelete() {
    if (!selectedRows.length) return;
    if (
      !window.confirm(
        `Delete ${selectedRows.length} selected finishing schedule${selectedRows.length === 1 ? "" : "s"}?`,
      )
    ) {
      return;
    }

    startBulkDeleteTransition(async () => {
      let deleted = 0;
      let failed = 0;

      for (const row of selectedRows) {
        const res = await deleteFinishingSchedule(row.id);
        if (res.ok) {
          deleted += 1;
          setRows((prev) => prev.filter((item) => item.id !== row.id));
        } else {
          failed += 1;
        }
      }

      setRowSelection({});
      if (deleted) toast.success(`Deleted ${deleted} schedule${deleted === 1 ? "" : "s"}.`);
      if (failed) toast.error(`${failed} schedule${failed === 1 ? "" : "s"} failed to delete.`);
      router.refresh();
    });
  }

  const columns: ColumnDef<ScheduleRow>[] = React.useMemo(
    () => [
      {
        id: "select",
        size: 42,
        enableSorting: false,
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
            aria-label="Select all visible schedules"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select schedule"
          />
        ),
      },
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
        id: "supervisor",
        accessorFn: (row) => row.site.supervisorName ?? "",
        size: 160,
        header: ({ column }) => (
          <SortableHeader
            column={column}
            icon={User}
            iconColor="text-emerald-600"
            label="Supervisor"
          />
        ),
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.site.supervisorName ?? "—"}
          </span>
        ),
      },
      {
        id: "contractNo",
        accessorKey: "contractNo",
        sortingFn: (rowA, rowB, columnId) => {
          const aValue = rowA.getValue<string | null>(columnId) ?? "";
          const bValue = rowB.getValue<string | null>(columnId) ?? "";
          const aNumber = Number(aValue);
          const bNumber = Number(bValue);
          const aIsNumber = !Number.isNaN(aNumber);
          const bIsNumber = !Number.isNaN(bNumber);

          if (aIsNumber && bIsNumber) {
            return aNumber - bNumber;
          }
          return String(aValue).localeCompare(String(bValue));
        },
        size: 130,
        header: ({ column }) => (
          <SortableHeader
            column={column}
            icon={Hash}
            iconColor="text-indigo-600"
            label="Job#"
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
            <RowActions schedule={row.original} onDeleted={handleDeleted} />
          </div>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: filteredRows,
    columns,
    getRowId: (row) => row.id,
    state: { sorting, pagination, rowSelection },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="border bg-card">
      <div className="flex flex-col gap-3 border-b bg-muted/30 p-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPagination((prev) => ({ ...prev, pageIndex: 0 }));
              }}
              placeholder="Search job number or site name"
              className="pl-9"
            />
          </div>
          <Select
            value={supervisorFilter}
            onValueChange={(value) => {
              setSupervisorFilter(value);
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
          >
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Filter by supervisor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All supervisors</SelectItem>
              {supervisors.map((supervisor) => (
                <SelectItem key={supervisor} value={supervisor}>
                  {supervisor}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedRows.length > 0 ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {selectedRows.length} selected
            </span>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
            >
              {bulkDeleting ? (
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete Selected
            </Button>
          </div>
        ) : null}
      </div>

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
          {filteredRows.length === 0
            ? 0
            : table.getState().pagination.pageIndex *
                table.getState().pagination.pageSize +
              1}{" "}
          to{" "}
          {Math.min(
            (table.getState().pagination.pageIndex + 1) *
              table.getState().pagination.pageSize,
            filteredRows.length,
          )}{" "}
          of {filteredRows.length} schedules
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
