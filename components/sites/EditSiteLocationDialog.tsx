"use client";

import * as React from "react";
import { toast } from "react-toastify";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod";
import { useState, useTransition } from "react";
import { Loader2, MapPin, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SiteLocationPicker from "@/components/sites/SiteLocationPicker";
import { updateSiteLocation } from "@/actions/sites";
import {
  assignSupervisorToSite,
  assignForemanToSite,
} from "@/actions/site-assignments";

const JOB_STATUS_OPTIONS = [
  { value: "NOT_STARTED", label: "Not Started" },
  { value: "ONGOING", label: "Ongoing" },
  { value: "COMPLETED", label: "Completed" },
  { value: "ON_HOLD", label: "On Hold" },
] as const;

const SPEC_STATUS_OPTIONS = [
  { value: "NOT_REQUESTED", label: "Not requested" },
  { value: "NOT_REQUIRED", label: "Not Required" },
  { value: "REQUESTED", label: "Requested" },
  { value: "RECEIVED", label: "Received" },
  { value: "ACTIONED", label: "Actioned" },
] as const;

type SpecStatusValue =
  | "NOT_REQUESTED"
  | "NOT_REQUIRED"
  | "REQUESTED"
  | "RECEIVED"
  | "ACTIONED";

const schema = z.object({
  name: z
    .string()
    .min(2, "Site name must be at least 2 characters.")
    .max(80, "Max 80 characters."),
  code: z.string().max(30, "Max 30 characters.").optional(),
  client: z.string().max(120, "Max 120 characters.").optional(),
  address: z.string().max(200, "Max 200 characters.").optional(),
  siteClaimDate: z.string().max(10).optional(),
  amountClaimed: z
    .number({ error: "Must be a number." })
    .min(0, "Cannot be negative.")
    .optional(),
  jobStatus: z
    .enum(["NOT_STARTED", "ONGOING", "COMPLETED", "ON_HOLD"])
    .optional(),
  specStatus: z
    .enum([
      "NOT_REQUESTED",
      "NOT_REQUIRED",
      "REQUESTED",
      "RECEIVED",
      "ACTIONED",
    ])
    .optional(),
  latitude: z
    .number({ error: "Latitude must be a number." })
    .min(-90, "Latitude must be between -90 and 90.")
    .max(90, "Latitude must be between -90 and 90.")
    .optional(),
  longitude: z
    .number({ error: "Longitude must be a number." })
    .min(-180, "Longitude must be between -180 and 180.")
    .max(180, "Longitude must be between -180 and 180.")
    .optional(),
  supervisorUserId: z.string().optional(),
  foremanUserId: z.string().optional(),
});

type PersonOption = {
  id: string;
  name: string;
  email: string;
};

export default function EditSiteLocationDialog(props: {
  siteId: string;
  initialName: string;
  initialCode?: string | null;
  initialClient?: string | null;
  initialLocation?: string | null;
  initialAddress?: string | null;
  initialLatitude?: number | null;
  initialLongitude?: number | null;
  initialSiteClaimDate?: string | null;
  initialAmountClaimed?: number | null;
  initialJobStatus?: "NOT_STARTED" | "ONGOING" | "COMPLETED" | "ON_HOLD" | null;
  initialSpecStatus?:
    | "NOT_REQUESTED"
    | "NOT_NEEDED"
    | "NOT_REQUIRED"
    | "REQUESTED"
    | "RECEIVED"
    | "ACTIONED"
    | null;
  initialSpecAvailable?: boolean | null;
  canEditCoreDetails?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  supervisorOptions?: PersonOption[];
  foremanOptions?: PersonOption[];
  initialSupervisorUserId?: string | null;
  initialForemanUserId?: string | null;
}) {
  const {
    siteId,
    initialName,
    initialCode,
    initialClient,
    initialLocation,
    initialAddress,
    initialLatitude,
    initialLongitude,
    initialSiteClaimDate,
    initialAmountClaimed,
    initialJobStatus,
    initialSpecStatus,
    initialSpecAvailable,
    canEditCoreDetails = false,
    open: controlledOpen,
    onOpenChange: controlledOnOpenChange,
    hideTrigger = false,
    supervisorOptions = [],
    foremanOptions = [],
    initialSupervisorUserId,
    initialForemanUserId,
  } = props;

  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [supervisorUserId, setSupervisorUserId] = useState("");
  const [foremanUserId, setForemanUserId] = useState("");
  const [assigningSuper, setAssigningSuper] = useState(false);
  const [assigningFore, setAssigningFore] = useState(false);
  const open = controlledOpen ?? internalOpen;

  const setOpen = (next: boolean) => {
    controlledOnOpenChange?.(next);
    if (controlledOpen === undefined) {
      setInternalOpen(next);
    }
  };

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initialName,
      code: initialCode ?? "",
      client: initialClient ?? "",
      address: initialAddress ?? initialLocation ?? "",
      siteClaimDate: initialSiteClaimDate?.slice(0, 10) ?? "",
      amountClaimed:
        typeof initialAmountClaimed === "number" ? initialAmountClaimed : 0,
      jobStatus: initialJobStatus ?? "NOT_STARTED",
      specStatus: normalizeInitialSpecStatus(
        initialSpecStatus,
        initialSpecAvailable,
      ),
      latitude:
        typeof initialLatitude === "number" ? initialLatitude : undefined,
      longitude:
        typeof initialLongitude === "number" ? initialLongitude : undefined,
    },
  });

  function normalizeDateInput(value?: string | null) {
    if (!value) return "";
    return value.slice(0, 10);
  }

  function normalizeInitialSpecStatus(
    status?: string | null,
    specAvailable?: boolean | null,
  ): SpecStatusValue {
    if (status === "NOT_NEEDED" || status === "NOT_REQUIRED") {
      return "NOT_REQUIRED";
    }
    if (
      status === "NOT_REQUESTED" ||
      status === "REQUESTED" ||
      status === "RECEIVED" ||
      status === "ACTIONED"
    ) {
      return status;
    }
    return specAvailable ? "RECEIVED" : "NOT_REQUESTED";
  }

  function resetFormValues() {
    form.reset({
      name: initialName,
      code: initialCode ?? "",
      client: initialClient ?? "",
      address: initialAddress ?? initialLocation ?? "",
      siteClaimDate: normalizeDateInput(initialSiteClaimDate),
      amountClaimed:
        typeof initialAmountClaimed === "number" ? initialAmountClaimed : 0,
      jobStatus: initialJobStatus ?? "NOT_STARTED",
      specStatus: normalizeInitialSpecStatus(
        initialSpecStatus,
        initialSpecAvailable,
      ),
      latitude:
        typeof initialLatitude === "number" ? initialLatitude : undefined,
      longitude:
        typeof initialLongitude === "number" ? initialLongitude : undefined,
    });
    setSupervisorUserId(initialSupervisorUserId ?? "");
    setForemanUserId(initialForemanUserId ?? "");
  }

  React.useEffect(() => {
    if (!open) return;
    resetFormValues();
  }, [
    open,
    initialName,
    initialCode,
    initialClient,
    initialLocation,
    initialAddress,
    initialLatitude,
    initialLongitude,
    initialSiteClaimDate,
    initialAmountClaimed,
    initialJobStatus,
    initialSpecStatus,
    initialSpecAvailable,
    initialSupervisorUserId,
    initialForemanUserId,
  ]);

  function onSubmit(values: z.infer<typeof schema>) {
    startTransition(async () => {
      const res = await updateSiteLocation({
        siteId,
        ...(canEditCoreDetails
          ? {
              name: values.name,
              code: values.code || null,
            }
          : {}),
        client: values.client || null,
        location: null,
        address: values.address || null,
        siteClaimDate: values.siteClaimDate || null,
        amountClaimed: values.amountClaimed ?? 0,
        jobStatus: values.jobStatus,
        specStatus: values.specStatus,
        latitude: values.latitude ?? null,
        longitude: values.longitude ?? null,
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      // Handle supervisor assignment if selected
      const selectedSupervisorUserId = supervisorUserId.trim();
      if (
        selectedSupervisorUserId &&
        selectedSupervisorUserId !== (initialSupervisorUserId ?? "")
      ) {
        setAssigningSuper(true);
        try {
          const superRes = await assignSupervisorToSite({
            siteId,
            supervisorUserId: selectedSupervisorUserId,
          });
          if (!superRes.ok) {
            toast.error(superRes.error ?? "Failed to assign supervisor");
          }
        } catch (err: any) {
          toast.error(err?.message ?? "Failed to assign supervisor");
        } finally {
          setAssigningSuper(false);
        }
      }

      // Handle foreman assignment if selected
      const selectedForemanUserId = foremanUserId.trim();
      if (
        selectedForemanUserId &&
        selectedForemanUserId !== (initialForemanUserId ?? "")
      ) {
        setAssigningFore(true);
        try {
          const foreRes = await assignForemanToSite({
            siteId,
            foremanUserId: selectedForemanUserId,
          });
          if (!foreRes.ok) {
            toast.error(foreRes.error ?? "Failed to assign foreman");
          }
        } catch (err: any) {
          toast.error(err?.message ?? "Failed to assign foreman");
        } finally {
          setAssigningFore(false);
        }
      }

      toast.success("Site updated.");
      setOpen(false);
      setPickerOpen(false);
      setSupervisorUserId("");
      setForemanUserId("");
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          resetFormValues();
        } else {
          setPickerOpen(false);
        }
      }}
    >
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Pencil className="h-4 w-4" />
            Edit Info
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Site details
          </DialogTitle>
          <DialogDescription>
            Update the site name, client, address, claim date and pin
            coordinates. Address and pin are optional.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-5 max-h-[70vh] overflow-y-auto pb-2"
        >
          <FieldGroup>
            {canEditCoreDetails && (
              <>
                <Controller
                  name="name"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                        Site Name <span className="text-red-500">*</span>
                      </FieldLabel>
                      <Input
                        {...field}
                        placeholder="e.g. Mall of Africa"
                        disabled={pending}
                        className="mt-1.5 dark:bg-zinc-800/50 dark:border-zinc-700/50"
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                <Controller
                  name="code"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                        Job Number{" "}
                        <span className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">
                          (Optional)
                        </span>
                      </FieldLabel>
                      <Input
                        {...field}
                        placeholder="e.g. MOA-001"
                        disabled={pending}
                        className="mt-1.5 dark:bg-zinc-800/50 dark:border-zinc-700/50"
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </>
            )}

            <Controller
              name="client"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    Client{" "}
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">
                      (Optional)
                    </span>
                  </FieldLabel>
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value)}
                    placeholder="e.g. Acme Corp"
                    disabled={pending}
                    className="mt-1.5 dark:bg-zinc-800/50 dark:border-zinc-700/50"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="address"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    Address{" "}
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">
                      (Optional)
                    </span>
                  </FieldLabel>
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value)}
                    placeholder="e.g. 123 Main Rd, Midrand, Gauteng"
                    disabled={pending}
                    className="mt-1.5 dark:bg-zinc-800/50 dark:border-zinc-700/50"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="siteClaimDate"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    Claim Date{" "}
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">
                      (Optional)
                    </span>
                  </FieldLabel>
                  <div className="mt-1.5 flex gap-2">
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value)}
                      type="date"
                      disabled={pending}
                      className="dark:bg-zinc-800/50 dark:border-zinc-700/50"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => field.onChange("")}
                      disabled={pending || !field.value}
                    >
                      Clear
                    </Button>
                  </div>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="amountClaimed"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    Amount Claimed{" "}
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">
                      (R)
                    </span>
                  </FieldLabel>
                  <Input
                    {...field}
                    value={field.value === 0 ? "" : (field.value ?? "")}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const num = parseFloat(raw);
                      field.onChange(raw === "" || isNaN(num) ? 0 : num);
                    }}
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    placeholder="0.00"
                    disabled={pending}
                    className="mt-1.5 dark:bg-zinc-800/50 dark:border-zinc-700/50"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="jobStatus"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    Job Status
                  </FieldLabel>
                  <Select
                    value={field.value ?? "NOT_STARTED"}
                    onValueChange={field.onChange}
                    disabled={pending}
                  >
                    <SelectTrigger className="mt-1.5 dark:bg-zinc-800/50 dark:border-zinc-700/50">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {JOB_STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />

            <Controller
              name="specStatus"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    Spec
                  </FieldLabel>
                  <Select
                    value={field.value ?? "NOT_REQUESTED"}
                    onValueChange={field.onChange}
                    disabled={pending}
                  >
                    <SelectTrigger className="mt-1.5 dark:bg-zinc-800/50 dark:border-zinc-700/50">
                      <SelectValue placeholder="Select spec status" />
                    </SelectTrigger>
                    <SelectContent>
                      {SPEC_STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />

            {supervisorOptions.length > 0 && (
              <Field>
                <FieldLabel className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  Assign Supervisor{" "}
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">
                    (Optional)
                  </span>
                </FieldLabel>
                <Select
                  value={supervisorUserId}
                  onValueChange={setSupervisorUserId}
                  disabled={pending || assigningSuper}
                >
                  <SelectTrigger className="mt-1.5 dark:bg-zinc-800/50 dark:border-zinc-700/50">
                    <SelectValue placeholder="Select supervisor" />
                  </SelectTrigger>
                  <SelectContent>
                    {supervisorOptions.map((sup) => (
                      <SelectItem key={sup.id} value={sup.id}>
                        {sup.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            {foremanOptions.length > 0 && (
              <Field>
                <FieldLabel className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  Assign Foreman{" "}
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">
                    (Optional)
                  </span>
                </FieldLabel>
                <Select
                  value={foremanUserId}
                  onValueChange={setForemanUserId}
                  disabled={pending || assigningFore}
                >
                  <SelectTrigger className="mt-1.5 dark:bg-zinc-800/50 dark:border-zinc-700/50">
                    <SelectValue placeholder="Select foreman" />
                  </SelectTrigger>
                  <SelectContent>
                    {foremanOptions.map((fore) => (
                      <SelectItem key={fore.id} value={fore.id}>
                        {fore.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  Pin coordinates{" "}
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">
                    (Optional)
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 px-3"
                    onClick={() => setPickerOpen((v) => !v)}
                    disabled={pending}
                  >
                    {pickerOpen ? "Hide map" : "Pick on map"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 px-3"
                    onClick={() => {
                      form.setValue("latitude", undefined, {
                        shouldValidate: true,
                      });
                      form.setValue("longitude", undefined, {
                        shouldValidate: true,
                      });
                    }}
                    disabled={pending}
                  >
                    Clear
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Controller
                  name="latitude"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                        Latitude
                      </FieldLabel>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value)}
                        type="number"
                        step="0.000001"
                        inputMode="decimal"
                        placeholder="-26.2041"
                        disabled={pending}
                        className="mt-1 dark:bg-zinc-800/50 dark:border-zinc-700/50"
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                <Controller
                  name="longitude"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                        Longitude
                      </FieldLabel>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value)}
                        type="number"
                        step="0.000001"
                        inputMode="decimal"
                        placeholder="28.0473"
                        disabled={pending}
                        className="mt-1 dark:bg-zinc-800/50 dark:border-zinc-700/50"
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </div>

              {pickerOpen && (
                <div className="space-y-2">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Click to set the pin, or drag the marker.
                  </p>
                  <SiteLocationPicker
                    disabled={pending}
                    value={
                      typeof form.watch("latitude") === "number" &&
                      typeof form.watch("longitude") === "number"
                        ? {
                            lat: form.watch("latitude") as number,
                            lng: form.watch("longitude") as number,
                          }
                        : null
                    }
                    onChange={(next) => {
                      form.setValue("latitude", next.lat, {
                        shouldValidate: true,
                      });
                      form.setValue("longitude", next.lng, {
                        shouldValidate: true,
                      });
                    }}
                    height={220}
                  />
                </div>
              )}
            </div>
          </FieldGroup>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1 gap-2" disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
