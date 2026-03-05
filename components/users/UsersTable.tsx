"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
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
  Shield,
  CalendarDays,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import EditUserInfoForm from "@/components/auth/EditUserInfoForm";

export type UserRow = {
  id: string;
  email: string;
  name: string | null;
  phone?: string | null;
  role: string;
  createdAt: Date;
};

function formatDate(d: Date | string) {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function getRoleBadgeVariant(role: string) {
  switch (role) {
    case "ADMIN":
      return "bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400";
    case "OFFICE":
      return "bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400";
    case "SUPERVISOR":
      return "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400";
    case "FOREMAN":
      return "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400";
    default:
      return "bg-zinc-500/10 text-zinc-600 dark:bg-zinc-500/20 dark:text-zinc-400";
  }
}

interface UsersTableProps {
  data: UserRow[];
  currentUserRole?: string;
  onDelete: (user: UserRow) => void;
}

export default function UsersTable({
  data,
  currentUserRole,
  onDelete,
}: UsersTableProps) {
  const router = useRouter();
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  });

  const columns: ColumnDef<UserRow>[] = React.useMemo(
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
          const user = row.original;
          const name = user.name || "—";
          const initials =
            name !== "—"
              ? name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
              : "?";
          return (
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border bg-primary text-white text-xs font-semibold">
                {initials}
              </div>
              <span className="font-semibold">{name}</span>
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
          <span className="text-sm font-mono">{row.original.email}</span>
        ),
      },
      {
        id: "role",
        accessorKey: "role",
        size: 120,
        header: () => (
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-orange-600" />
            Role
          </div>
        ),
        cell: ({ row }) => (
          <Badge
            variant="secondary"
            className={`text-[11px] font-semibold ${getRoleBadgeVariant(row.original.role)}`}
          >
            {row.original.role}
          </Badge>
        ),
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
              <CalendarDays className="h-4 w-4 text-emerald-600" />
              Created
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
          <UserRowActions
            user={row.original}
            currentUserRole={currentUserRole}
            onDelete={() => onDelete(row.original)}
          />
        ),
      },
    ],
    [currentUserRole, onDelete],
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
          of {data.length} users
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

function UserRowActions({
  user,
  currentUserRole,
  onDelete,
}: {
  user: UserRow;
  currentUserRole?: string;
  onDelete: () => void;
}) {
  const [editOpen, setEditOpen] = React.useState(false);

  return (
    <div className="text-center">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Row actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem
            className="flex items-center gap-2"
            onSelect={(e) => {
              e.preventDefault();
              setEditOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="flex items-center gap-2 text-red-600 focus:text-red-600"
            onSelect={(e) => {
              e.preventDefault();
              onDelete();
            }}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user information.</DialogDescription>
          </DialogHeader>
          <EditUserInfoForm
            userInfo={{
              id: user.id,
              email: user.email,
              name: user.name ?? "",
              phone: user.phone ?? null,
              role: user.role,
              createdAt: user.createdAt,
            }}
            currentUserRole={currentUserRole}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
