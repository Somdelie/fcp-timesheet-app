"use client";

// components/auth/EditUserInfoForm.tsx
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateUser, updateUserPassword } from "@/actions/user";

interface EditUserInfoFormProps {
  userInfo: {
    id: string;
    email: string;
    name: string;
    role: string;
    createdAt: Date;
  };
  currentUserRole?: string; // Role of the user viewing this form (to determine if they can edit password)
}

const EditUserInfoForm = ({
  userInfo,
  currentUserRole,
}: EditUserInfoFormProps) => {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [name, setName] = React.useState(userInfo.name);
  const [email, setEmail] = React.useState(userInfo.email);
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);

  const isAdmin = currentUserRole === "ADMIN";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const nextName = name.trim();
    const nextEmail = email.trim();
    const nextPassword = password.trim();

    startTransition(async () => {
      // Update basic info
      const res = await updateUser({
        id: userInfo.id,
        name: nextName,
        email: nextEmail,
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      // If password is provided and current user is ADMIN, update it
      if (nextPassword && isAdmin) {
        const pwdRes = await updateUserPassword({
          userId: userInfo.id,
          newPassword: nextPassword,
        });

        if (!pwdRes.ok) {
          toast.error(
            "User updated, but password update failed: " + pwdRes.error,
          );
          setOpen(false);
          router.refresh();
          return;
        }

        toast.success("User and password updated");
      } else {
        toast.success("User updated");
      }

      setOpen(false);
      setPassword("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 dark:border-zinc-700/50 dark:bg-zinc-800/50 dark:text-white dark:hover:bg-zinc-700/50"
        >
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>
              {isAdmin
                ? "Update the user's name, email, or password."
                : "Update the user's name or email, then save changes."}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <Label htmlFor={`name-${userInfo.id}`}>Name</Label>
              <Input
                id={`name-${userInfo.id}`}
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor={`email-${userInfo.id}`}>Email</Label>
              <Input
                id={`email-${userInfo.id}`}
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>

            {isAdmin && (
              <Field>
                <div className="flex items-center justify-between">
                  <Label htmlFor={`password-${userInfo.id}`}>
                    New Password
                  </Label>
                  <a
                    href="#"
                    className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowPassword(!showPassword);
                    }}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </a>
                </div>
                <Input
                  id={`password-${userInfo.id}`}
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Leave blank to keep current password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Minimum 8 characters. Leave blank if you don't want to change
                  it.
                </p>
              </Field>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditUserInfoForm;
