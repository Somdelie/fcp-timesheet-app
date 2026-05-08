"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { Search, Plus } from "lucide-react";

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
import CreateUserForm from "@/components/auth/CreateUserForm";
import UsersTable, { type UserRow } from "@/components/users/UsersTable";

export interface User {
  id: string;
  email: string;
  name: string | null;
  phone?: string | null;
  role: string;
  createdAt: Date;
}

interface UsersListProps {
  users: User[];
  currentUserRole?: string;
}

const UserList: React.FC<UsersListProps> = ({ users, currentUserRole }) => {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [deleteDialogUser, setDeleteDialogUser] =
    React.useState<UserRow | null>(null);
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

  async function handleDeleteUser(user: UserRow) {
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
    <div className="mx-auto max-w-7xl space-y-4">
      {/* Search */}
      <div className="mb-3 rounded border border-zinc-200/50 bg-white/80 backdrop-blur-sm px-5 py-3 shadow-sm transition-all hover:shadow-md dark:border-zinc-700/50 dark:bg-card/40">
        <div className="flex flex-col gap-4 sm:flex-row items-end sm:justify-between">
          <div className="flex-1 w-full">
            {/* <label
              htmlFor="search-users"
              className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2"
            >
              Search Users, Manage application users and their roles.
            </label> */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
              <Input
                id="search-users"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, email, or role..."
                className="h-10 pl-9 dark:bg-zinc-800/50 dark:border-zinc-700/50 dark:text-white dark:placeholder-zinc-500"
              />
            </div>
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
        <UsersTable
          data={filtered}
          currentUserRole={currentUserRole}
          onDelete={(user) => setDeleteDialogUser(user)}
        />
      )}

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteDialogUser !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteDialogUser(null);
            setDeleteInput("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete user</DialogTitle>
            <DialogDescription>
              This action cannot be undone. To confirm, type the user&apos;s
              email
              <span className="mx-1 font-mono text-xs font-semibold">
                {deleteDialogUser?.email}
              </span>
              below and click confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              autoFocus
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder={deleteDialogUser?.email ?? ""}
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
                deleting || deleteInput.trim() !== deleteDialogUser?.email
              }
              onClick={() =>
                deleteDialogUser && handleDeleteUser(deleteDialogUser)
              }
            >
              {deleting ? "Deleting..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserList;
