"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { X, Upload } from "lucide-react";

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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { updateEmployee } from "@/actions/employees";

interface EditEmployeeFormProps {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    faceImageUrl: string | null;
    isActive: boolean;
    defaultDayRate?: string | null;
    userId?: string | null;
  };
}

export default function EditEmployeeForm({ employee }: EditEmployeeFormProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [firstName, setFirstName] = React.useState(employee.firstName);
  const [lastName, setLastName] = React.useState(employee.lastName);
  const [faceImageUrl, setFaceImageUrl] = React.useState(
    employee.faceImageUrl ?? "",
  );
  const [isActive, setIsActive] = React.useState(employee.isActive);
  const [uploading, setUploading] = React.useState(false);
  const [dragActive, setDragActive] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [defaultDayRate, setDefaultDayRate] = React.useState(
    employee.defaultDayRate ?? "",
  );
  const isForeman = !!employee.userId;

  async function handleUpload(file: File) {
    if (!file) return;

    try {
      setUploading(true);
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "employees");

      const res = await fetch("/api/uploads/image", {
        method: "POST",
        body: fd,
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = payload?.error || "Upload failed";
        throw new Error(msg);
      }

      const url = String(payload.url ?? "");
      if (!url) throw new Error("Upload did not return a URL.");

      setFaceImageUrl(url);
      toast.success("Photo uploaded successfully");
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload photo");
    } finally {
      setUploading(false);
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      handleUpload(file);
    }
    e.target.value = "";
  }

  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      handleUpload(file);
    } else {
      toast.error("Please drop an image file");
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const nextFirst = firstName.trim();
    const nextLast = lastName.trim();

    const payload: any = {
      id: employee.id,
      faceImageUrl: faceImageUrl || null,
      isActive,
    };

    // Only allow name edits for non-foreman employees
    if (!isForeman) {
      payload.firstName = nextFirst;
      payload.lastName = nextLast;
    }

    if (isForeman) {
      payload.defaultDayRate = defaultDayRate || null;
    }

    startTransition(async () => {
      const res = await updateEmployee(payload);

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success("Employee updated");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Edit employee</DialogTitle>
            <DialogDescription>
              Update the employee's details and photo, then save changes.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="firstName-edit">First name</FieldLabel>
              <Input
                id="firstName-edit"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={isForeman}
              />
              {isForeman && (
                <p className="text-xs text-muted-foreground mt-1">
                  Foreman names are managed from the user profile.
                </p>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="lastName-edit">Last name</FieldLabel>
              <Input
                id="lastName-edit"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={isForeman}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="defaultDayRate-edit">Day rate</FieldLabel>
              <Input
                id="defaultDayRate-edit"
                type="text"
                value={defaultDayRate}
                onChange={(e) => setDefaultDayRate(e.target.value)}
                disabled={!isForeman}
                placeholder={
                  isForeman ? "e.g. 100.00" : "Only foreman can edit"
                }
              />
              {!isForeman && (
                <p className="text-xs text-muted-foreground mt-1">
                  Regular employees use the company default day rate
                </p>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="faceImageUrl-edit">Face image</FieldLabel>
              <div className="space-y-3">
                {faceImageUrl ? (
                  // Show image preview
                  <div className="relative">
                    <div className="rounded-lg border-2 border-dashed border-green-500 bg-green-50/30 p-4 dark:bg-green-950/20">
                      <div className="flex items-end gap-3">
                        <img
                          src={faceImageUrl}
                          alt="Preview"
                          className="h-24 w-24 rounded-lg object-cover shadow-sm"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-green-700 dark:text-green-300">
                            ✓ Image uploaded
                          </p>
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                            Ready to save
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFaceImageUrl("")}
                          className="rounded-lg bg-white p-1.5 hover:bg-red-50 text-red-600 dark:bg-zinc-800 dark:hover:bg-red-950/30 transition"
                          title="Remove image"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Show upload area
                  <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    className={`relative rounded-lg border-2 border-dashed transition-colors p-6 text-center cursor-pointer ${
                      dragActive
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                        : "border-zinc-300 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900/30 hover:border-blue-400 dark:hover:border-blue-400"
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileInputChange}
                      disabled={uploading}
                    />
                    <div className="flex flex-col items-center gap-2">
                      <div className="rounded-full bg-blue-100 p-3 dark:bg-blue-950/50">
                        <Upload className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-900 dark:text-white">
                          {uploading
                            ? "Uploading..."
                            : "Click to upload or drag image here"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          PNG, JPG, GIF up to 5MB
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Field>
            <Field>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <span>Active</span>
              </label>
            </Field>
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
            <Button type="submit" disabled={pending || uploading}>
              {pending || uploading ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
