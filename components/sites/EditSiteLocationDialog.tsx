"use client";

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
import SiteLocationPicker from "@/components/sites/SiteLocationPicker";
import { updateSiteLocation } from "@/actions/sites";

const schema = z.object({
  location: z.string().max(120, "Max 120 characters.").optional(),
  address: z.string().max(200, "Max 200 characters.").optional(),
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
});

export default function EditSiteLocationDialog(props: {
  siteId: string;
  initialLocation?: string | null;
  initialAddress?: string | null;
  initialLatitude?: number | null;
  initialLongitude?: number | null;
}) {
  const {
    siteId,
    initialLocation,
    initialAddress,
    initialLatitude,
    initialLongitude,
  } = props;

  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      location: initialLocation ?? "",
      address: initialAddress ?? "",
      latitude:
        typeof initialLatitude === "number" ? initialLatitude : undefined,
      longitude:
        typeof initialLongitude === "number" ? initialLongitude : undefined,
    },
  });

  function onSubmit(values: z.infer<typeof schema>) {
    startTransition(async () => {
      const res = await updateSiteLocation({
        siteId,
        location: values.location || null,
        address: values.address || null,
        latitude: values.latitude ?? null,
        longitude: values.longitude ?? null,
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success("Site location updated.");
      setOpen(false);
      setPickerOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setPickerOpen(false);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Pencil className="h-4 w-4" />
          Edit location
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Site location
          </DialogTitle>
          <DialogDescription>
            Address and pin are optional. You can save either, both, or none.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <FieldGroup>
            <Controller
              name="location"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    Location label{" "}
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">
                      (Optional)
                    </span>
                  </FieldLabel>
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value)}
                    placeholder="e.g. Midrand, Gauteng"
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
