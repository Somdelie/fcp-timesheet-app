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
import {
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  User,
  Mail,
  BadgeDollarSign,
  CalendarDays,
  MoreHorizontal,
  Eye,
  UserPlus,
  Users,
  Landmark,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ForemanRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  foreman: {
    id: string;
    defaultDayRate: string | null;
    defaultTeam: string;
    bankName: string | null;
    createdAt: string;
    supervisorId: string | null;
    supervisorName: string | null;
    assistants?: Array<{
      id: string;
      name: string;
      email: string | null;
      qrCodeValue: string;
      startsOn: string;
    }>;
  } | null;
  isAssistant: boolean;
};

const TEAM_LABELS: Record<string, string> = {
  PAINTERS: "Painters",
  BUILDING: "Building",
  SPECIAL_COATINGS: "Special Coatings",
  CAPE_TOWN: "Cape Town",
};

const TEAM_COLORS: Record<string, string> = {
  PAINTERS: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  BUILDING:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  SPECIAL_COATINGS:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  CAPE_TOWN:
    "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
};

type TeamOption = {
  value: string;
  label: string;
};

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function formatMoney(s: string | null) {
  if (!s) return "—";
  const n = Number(String(s).replace(",", "."));
  if (!Number.isFinite(n)) return `R ${s}`;
  return `R ${n.toFixed(2)}`;
}

interface ForemenTableProps<TForeman extends ForemanRow> {
  data: TForeman[];
  teamOptions?: TeamOption[];
  onView: (foreman: TForeman) => void;
  onAddAssistant?: (foreman: TForeman) => void;
  onSwitchTeam?: (foreman: TForeman) => void;
  onEditBank?: (foreman: TForeman) => void;
}

export default function ForemenTable<TForeman extends ForemanRow>({
  data,
  teamOptions = [],
  onView,
  onAddAssistant,
  onSwitchTeam,
  onEditBank,
}: ForemenTableProps<TForeman>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  });
  const teamLabels = React.useMemo(
    () => ({
      ...TEAM_LABELS,
      ...Object.fromEntries(teamOptions.map((team) => [team.value, team.label])),
    }),
    [teamOptions],
  );

  const columns: ColumnDef<TForeman>[] = React.useMemo(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(isSorted === "asc")}
            >
              <User className="h-4 w-4 text-sky-600" />
              Name
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
          const foreman = row.original;
          const initials = foreman.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2);
          return (
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border bg-primary text-white text-xs font-semibold">
                {initials}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{foreman.name}</span>
                {foreman.isAssistant && (
                  <Badge
                    variant="secondary"
                    className="text-[11px] bg-orange-700/20 text-orange-700 dark:bg-orange-300/20 dark:text-orange-300"
                  >
                    Assistant
                  </Badge>
                )}
              </div>
            </div>
          );
        },
      },
      {
        id: "email",
        accessorKey: "email",
        size: 220,
        header: () => (
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-indigo-600" />
            Email
          </div>
        ),
        cell: ({ row }) => (
          <span className="text-sm">{row.original.email}</span>
        ),
      },
      {
        id: "dayRate",
        accessorFn: (row) => row.foreman?.defaultDayRate ?? null,
        size: 130,
        header: () => (
          <div className="flex items-center gap-2">
            <BadgeDollarSign className="h-4 w-4 text-emerald-600" />
            Day Rate
          </div>
        ),
        cell: ({ row }) => {
          if (row.original.isAssistant) {
            return (
              <span className="text-xs text-muted-foreground italic">
                Assistant
              </span>
            );
          }
          return (
            <span className="text-sm">
              {formatMoney(row.original.foreman?.defaultDayRate ?? null)}
            </span>
          );
        },
      },
      {
        id: "team",
        accessorFn: (row) => row.foreman?.defaultTeam ?? null,
        size: 150,
        header: () => (
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-violet-600" />
            Team
          </div>
        ),
        cell: ({ row }) => {
          if (row.original.isAssistant) {
            return (
              <span className="text-xs text-muted-foreground italic">—</span>
            );
          }
          const team = row.original.foreman?.defaultTeam ?? "PAINTERS";
          return (
            <Badge
              variant="secondary"
              className={`text-[11px] font-medium ${TEAM_COLORS[team] ?? ""}`}
            >
              {teamLabels[team] ?? team}
            </Badge>
          );
        },
      },
      {
        id: "createdAt",
        accessorKey: "createdAt",
        size: 110,
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(isSorted === "asc")}
            >
              <CalendarDays className="h-4 w-4 text-orange-600" />
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
        size: 80,
        header: () => <div className="text-center">Actions</div>,
        cell: ({ row }) => (
          <div className="text-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Row actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  className="flex items-center gap-2"
                  onSelect={(e) => {
                    e.preventDefault();
                    onView(row.original);
                  }}
                >
                  <Eye className="h-4 w-4" />
                  View Details
                </DropdownMenuItem>
                {!row.original.isAssistant && onAddAssistant && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="flex items-center gap-2"
                      onSelect={(e) => {
                        e.preventDefault();
                        onAddAssistant(row.original);
                      }}
                    >
                      <UserPlus className="h-4 w-4" />
                      Add Assistant
                    </DropdownMenuItem>
                  </>
                )}
                {!row.original.isAssistant && onSwitchTeam && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="flex items-center gap-2"
                      onSelect={(e) => {
                        e.preventDefault();
                        onSwitchTeam(row.original);
                      }}
                    >
                      <Users className="h-4 w-4" />
                      Switch Team
                    </DropdownMenuItem>
                  </>
                )}
                {!row.original.isAssistant && onEditBank && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="flex items-center gap-2"
                      onSelect={(e) => {
                        e.preventDefault();
                        onEditBank(row.original);
                      }}
                    >
                      <Landmark className="h-4 w-4" />
                      Edit Bank Name
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [onView, onAddAssistant, onSwitchTeam, onEditBank, teamLabels],
  );

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
                    style={{
                      width:
                        header.column.getSize() !== 150
                          ? header.column.getSize()
                          : undefined,
                    }}
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
                      style={{
                        width:
                          cell.column.getSize() !== 150
                            ? cell.column.getSize()
                            : undefined,
                      }}
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
          of {data.length} foremen
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
