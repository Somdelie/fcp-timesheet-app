"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import {
  X,
  Upload,
  User,
  DollarSign,
  Calendar,
  ChevronDown,
} from "lucide-react";

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
import { Input } from "@/components/ui/input";
import { updateEmployee } from "@/actions/employees";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-3">
      {children}
    </p>
  );
}

function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-xs text-zinc-400 dark:text-zinc-500">{hint}</p>
      )}
    </div>
  );
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
      if (!res.ok) throw new Error(payload?.error || "Upload failed");
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
    if (file) handleUpload(file);
    e.target.value = "";
  }

  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith("image/")) handleUpload(file);
    else toast.error("Please drop an image file");
  }

  // Note: temporary day-rate overrides are now configured per site+foreman
  // on the site management page, not per employee here.

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const payload: any = {
      id: employee.id,
      faceImageUrl: faceImageUrl || null,
      isActive,
    };
    if (!isForeman) {
      payload.firstName = firstName.trim();
      payload.lastName = lastName.trim();
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
        <button className="inline-flex items-center gap-1.5 rounded border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800">
          Edit
        </button>
      </DialogTrigger>

      <DialogContent className="p-0 sm:max-w-130 max-h-[90vh] overflow-hidden flex flex-col rounded border-0 shadow-2xl dark:shadow-black/60">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col h-full overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded bg-zinc-100 dark:bg-zinc-800">
                <User className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-zinc-900 dark:text-white">
                  Edit employee
                </DialogTitle>
                <DialogDescription className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Update details for{" "}
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    {employee.firstName} {employee.lastName}
                  </span>
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
            {/* Basic info */}
            <div>
              <SectionLabel>Basic information</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  label="First name"
                  hint={isForeman ? "Managed from user profile" : undefined}
                >
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    disabled={isForeman}
                    className={`h-9 rounded border-zinc-200 dark:border-zinc-700 text-sm ${isForeman ? "opacity-50 cursor-not-allowed bg-zinc-50 dark:bg-zinc-900" : ""}`}
                  />
                </FormField>
                <FormField label="Last name">
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    disabled={isForeman}
                    className={`h-9 rounded border-zinc-200 dark:border-zinc-700 text-sm ${isForeman ? "opacity-50 cursor-not-allowed bg-zinc-50 dark:bg-zinc-900" : ""}`}
                  />
                </FormField>
              </div>

              {/* Status toggle */}
              <div className="mt-3 flex items-center justify-between rounded border border-zinc-200 bg-zinc-50/60 px-3.5 py-2.5 dark:border-zinc-700 dark:bg-zinc-800/40">
                <div>
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    Active status
                  </p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                    {isActive
                      ? "Employee is currently active"
                      : "Employee is currently inactive"}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isActive}
                  onClick={() => setIsActive(!isActive)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 ${
                    isActive
                      ? "bg-zinc-800 dark:bg-zinc-200"
                      : "bg-zinc-200 dark:bg-zinc-600"
                  }`}
                >
                  <span
                    className={`pointer-events-none block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
                      isActive ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Day rate */}
            <div>
              <SectionLabel>Compensation</SectionLabel>
              <FormField
                label="Default day rate (R)"
                hint={
                  !isForeman
                    ? "Regular employees use the company default rate"
                    : undefined
                }
              >
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">
                    R
                  </span>
                  <Input
                    type="text"
                    value={defaultDayRate}
                    onChange={(e) => setDefaultDayRate(e.target.value)}
                    disabled={!isForeman}
                    placeholder={isForeman ? "e.g. 100.00" : "—"}
                    className={`h-9 rounded border-zinc-200 dark:border-zinc-700 text-sm pl-7 ${!isForeman ? "opacity-50 cursor-not-allowed bg-zinc-50 dark:bg-zinc-900" : ""}`}
                  />
                </div>
              </FormField>
            </div>

            {/* Per-employee temporary rate overrides have moved to the site
                management screen as site + foreman overrides. */}

            {/* Photo upload */}
            <div>
              <SectionLabel>Profile photo</SectionLabel>
              {faceImageUrl ? (
                <div className="flex items-center gap-4 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50/40 dark:bg-zinc-800/30 p-4">
                  <img
                    src={faceImageUrl}
                    alt="Preview"
                    className="h-16 w-16 rounded object-cover shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-700"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                      Photo uploaded
                    </p>
                    <p className="text-xs text-zinc-400 mt-0.5 truncate">
                      {faceImageUrl.split("/").pop()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFaceImageUrl("")}
                    className="shrink-0 flex items-center justify-center h-7 w-7 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 dark:hover:bg-red-950/20 transition"
                    title="Remove photo"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative cursor-pointer rounded border-2 border-dashed transition-all p-6 text-center ${
                    dragActive
                      ? "border-zinc-400 bg-zinc-100 dark:bg-zinc-800"
                      : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileInputChange}
                    disabled={uploading}
                  />
                  <div className="flex flex-col items-center gap-2.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                      <Upload
                        className={`h-4 w-4 ${uploading ? "text-zinc-300 animate-bounce" : "text-zinc-400"}`}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        {uploading ? "Uploading…" : "Upload a photo"}
                      </p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Drag & drop or click · PNG, JPG up to 5MB
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 flex items-center justify-between gap-3 border-t border-zinc-100 dark:border-zinc-800 px-6 py-4 bg-zinc-50/60 dark:bg-zinc-900/60">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="px-4 py-2 rounded text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || uploading}
              className="px-4 py-2 rounded bg-zinc-900 dark:bg-white text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-100 transition disabled:opacity-50 shadow-sm"
            >
              {pending || uploading ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
