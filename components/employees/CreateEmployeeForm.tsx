"use client";

import { toast } from "react-toastify";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { X, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createEmployee } from "@/actions/employees";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";

const employeeSchema = z.object({
  firstName: z
    .string()
    .min(2, "First name must be at least 2 characters.")
    .max(60, "Max 60 characters."),
  lastName: z
    .string()
    .min(2, "Last name must be at least 2 characters.")
    .max(60, "Max 60 characters."),
  phone: z.string().max(30, "Max 30 characters.").optional(),
  faceImageUrl: z.string().max(500, "Max 500 characters.").optional(),
});

export default function CreateEmployeeForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [lastQr, setLastQr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const create = sp.get("create");
    if (create !== "employee") return;

    setOpen(true);

    const params = new URLSearchParams(sp.toString());
    params.delete("create");
    const qs = params.toString();
    router.replace(qs ? `/employees?${qs}` : "/employees");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  const form = useForm<z.infer<typeof employeeSchema>>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      faceImageUrl: "",
    },
  });

  function resetFormAndState() {
    form.reset({
      firstName: "",
      lastName: "",
      phone: "",
      faceImageUrl: "",
    });
    setLastQr(null);
  }

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

      form.setValue("faceImageUrl", url, { shouldValidate: true });
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

  function onSubmit(values: z.infer<typeof employeeSchema>) {
    startTransition(async () => {
      const res = await createEmployee({
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone || null,
        faceImageUrl: values.faceImageUrl || null,
        isActive: true,
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success(
        `Employee created: ${res.employee.firstName} ${res.employee.lastName} (QR: ${res.employee.qrCodeValue})`,
      );

      // If you still want to show QR somewhere else, keep it:
      // setLastQr(res.employee.qrCodeValue);

      // ✅ reset + close
      resetFormAndState();
      setOpen(false);

      // Refresh the employees page so the new employee
      // appears immediately in the server-rendered list.
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Optional: when closing manually, clear the QR + form
        if (!next) resetFormAndState();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button">Add New Employee</Button>
      </DialogTrigger>

      <DialogContent>
        <DialogTitle>Add New Employee</DialogTitle>

        {/* If you want the QR visible while dialog is open, keep lastQr and set it on success */}
        {lastQr && (
          <div className="rounded-md border p-3 text-sm">
            <div className="font-medium">Generated QR value</div>
            <div className="mt-1 font-mono">{lastQr}</div>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <form
            id="create-employee-form"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <FieldGroup>
              <Controller
                name="firstName"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="firstName">First name</FieldLabel>
                    <Input
                      {...field}
                      id="firstName"
                      aria-invalid={fieldState.invalid}
                      placeholder="e.g. John"
                      autoComplete="off"
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="lastName"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="lastName">Last name</FieldLabel>
                    <Input
                      {...field}
                      id="lastName"
                      aria-invalid={fieldState.invalid}
                      placeholder="e.g. Dlamini"
                      autoComplete="off"
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="phone"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="phone">Phone (optional)</FieldLabel>
                    <Input
                      {...field}
                      id="phone"
                      aria-invalid={fieldState.invalid}
                      placeholder="e.g. 0821234567"
                      autoComplete="off"
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="faceImageUrl"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="faceImageUrl">
                      Face image (optional)
                    </FieldLabel>
                    <div className="space-y-3">
                      {field.value ? (
                        // Show image preview
                        <div className="relative">
                          <div className="rounded-lg border-2 border-dashed border-green-500 bg-green-50/30 p-4 dark:bg-green-950/20">
                            <div className="flex items-end gap-3">
                              <img
                                src={field.value}
                                alt="Preview"
                                className="h-24 w-24 rounded-lg object-cover shadow-sm"
                              />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-green-700 dark:text-green-300">
                                  ✓ Image uploaded
                                </p>
                                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                  Ready to create employee
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => field.onChange("")}
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
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </FieldGroup>
          </form>

          <Field orientation="horizontal" className="justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={resetFormAndState}
              disabled={pending}
            >
              Reset
            </Button>

            <Button
              type="submit"
              form="create-employee-form"
              disabled={pending}
            >
              {pending ? (
                <span className="flex items-center gap-2">
                  <Spinner />
                  Creating...
                </span>
              ) : (
                "Create employee"
              )}
            </Button>
          </Field>
        </div>
      </DialogContent>
    </Dialog>
  );
}
