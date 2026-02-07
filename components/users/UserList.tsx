"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { Search, Plus, Trash2, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import CreateUserForm from "@/components/auth/CreateUserForm";
import EditUserInfoForm from "@/components/auth/EditUserInfoForm";

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: Date;
}

function formatDate(d: Date | string) {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

interface UsersListProps {
  users: User[];
  currentUserRole?: string;
}

const UserList: React.FC<UsersListProps> = ({ users, currentUserRole }) => {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [deleteDialogUser, setDeleteDialogUser] = React.useState<User | null>(
    null,
  );
  const [deleteInput, setDeleteInput] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const name = u.name ?? "";
      return (
        u.email.toLowerCase().includes(q) ||
        name.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
      );
    });
  }, [users, query]);

  async function handleDeleteUser(user: User) {
    try {
      setDeleting(true);
      const res = await fetch("/api/app/admin/users/" + user.id, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("Failed to delete user");
        return;
      }
      toast.success(`User deleted: ${user.email}`);
      setDeleteDialogUser(null);
      setDeleteInput("");
      router.refresh();
    } catch (e) {
      toast.error("Failed to delete user");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl py-2 space-y-6">
      {/* Header */}
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage application users and their roles.
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="gap-2" size="lg">
              <Plus className="h-4 w-4" />
              New User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create a New User</DialogTitle>
              <DialogDescription>
                Add a new user to the system.
              </DialogDescription>
            </DialogHeader>
            <CreateUserForm />
          </DialogContent>
        </Dialog>
      </div>

      {/* Controls */}
      <div className="mb-4 rounded border border-zinc-200/50 bg-white/80 p-5 shadow-sm dark:border-zinc-700/50 dark:bg-card/40">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <label
              htmlFor="search-users"
              className="mb-2 block text-sm font-semibold text-zinc-700 dark:text-zinc-300"
            >
              Search Users
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
                <Input
                  id="search-users"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name, email, or role..."
                  className="h-10 pl-9 dark:border-zinc-700/50 dark:bg-zinc-800/50 dark:text-white dark:placeholder-zinc-500"
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              {filtered.length} user{filtered.length === 1 ? "" : "s"} found
            </p>
          </div>
        </div>
      </div>

      {/* Users table */}
      {filtered.length === 0 ? (
        <div className="rounded border border-dashed border-zinc-300 bg-white/50 p-12 text-center dark:border-zinc-700/50 dark:bg-card/30">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-slate-950">
            <Search className="h-6 w-6 text-zinc-400 dark:text-zinc-500" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
            No users found
          </h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Try adjusting your search or create a new user.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-zinc-200/60 bg-white/80 shadow-sm dark:border-zinc-700/60 dark:bg-zinc-900/40">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-65">Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-50 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => (
                  <TableRow
                    key={u.id}
                    className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/60"
                  >
                    <TableCell className="font-semibold text-zinc-900 dark:text-white">
                      {u.name ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-zinc-800 dark:text-zinc-300">
                      {u.email}
                    </TableCell>
                    <TableCell className="uppercase text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      {u.role}
                    </TableCell>
                    <TableCell className="text-zinc-800 dark:text-zinc-300">
                      {formatDate(u.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <EditUserInfoForm
                          userInfo={{
                            id: u.id,
                            email: u.email,
                            name: u.name ?? "",
                            role: u.role,
                            createdAt: u.createdAt,
                          }}
                          currentUserRole={currentUserRole}
                        />

                        <Dialog
                          open={deleteDialogUser?.id === u.id}
                          onOpenChange={(open) => {
                            if (open) {
                              setDeleteDialogUser(u);
                              setDeleteInput("");
                            } else {
                              setDeleteDialogUser(null);
                              setDeleteInput("");
                            }
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 border-red-500/40 text-red-600 hover:bg-red-50 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md">
                            <DialogHeader>
                              <DialogTitle>Delete user</DialogTitle>
                              <DialogDescription>
                                This action cannot be undone. To confirm, type
                                the user&apos;s email
                                <span className="mx-1 font-mono text-xs font-semibold">
                                  {u.email}
                                </span>
                                below and click confirm.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-3 py-2">
                              <Input
                                autoFocus
                                value={deleteInput}
                                onChange={(e) => setDeleteInput(e.target.value)}
                                placeholder={u.email}
                                className="font-mono text-xs"
                              />
                            </div>
                            <DialogFooter>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  setDeleteDialogUser(null);
                                  setDeleteInput("");
                                }}
                                disabled={deleting}
                              >
                                Cancel
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                disabled={
                                  deleting || deleteInput.trim() !== u.email
                                }
                                onClick={() => handleDeleteUser(u)}
                              >
                                {deleting ? "Deleting..." : "Confirm"}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserList;
