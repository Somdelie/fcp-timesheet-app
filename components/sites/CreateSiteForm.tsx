"use client";

import { toast } from "react-toastify";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createSite } from "@/actions/sites";
import SiteLocationPicker from "@/components/sites/SiteLocationPicker";

const siteSchema = z.object({
  name: z
    .string()
    .min(2, "Site name must be at least 2 characters.")
    .max(80, "Max 80 characters."),
  code: z.string().max(30, "Max 30 characters.").optional(),
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

interface CreateSiteFormProps {
  onSuccess?: () => void;
}

export default function CreateSiteForm({ onSuccess }: CreateSiteFormProps) {
  const [pending, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);

  const form = useForm<z.infer<typeof siteSchema>>({
    resolver: zodResolver(siteSchema),
    defaultValues: {
      name: "",
      code: "",
      location: "",
      address: "",
      latitude: undefined,
      longitude: undefined,
    },
  });

  function onSubmit(values: z.infer<typeof siteSchema>) {
    startTransition(async () => {
      const res = await createSite({
        name: values.name,
        code: values.code || null,
        location: values.location || null,
        address: values.address || null,
        latitude: values.latitude ?? null,
        longitude: values.longitude ?? null,
        isActive: true,
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success(`Created site: ${res.site.name}`);
      form.reset({
        name: "",
        code: "",
        location: "",
        address: "",
        latitude: undefined,
        longitude: undefined,
      });
      onSuccess?.();
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <FieldGroup>
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel
                htmlFor="name"
                className="text-sm font-semibold text-zinc-700 dark:text-zinc-300"
              >
                Site Name <span className="text-red-500">*</span>
              </FieldLabel>
              <Input
                {...field}
                id="name"
                aria-invalid={fieldState.invalid}
                placeholder="e.g. Mall of Africa"
                autoComplete="off"
                disabled={pending}
                className="mt-1.5 dark:bg-zinc-800/50 dark:border-zinc-700/50 dark:text-white dark:placeholder-zinc-500"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="code"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel
                htmlFor="code"
                className="text-sm font-semibold text-zinc-700 dark:text-zinc-300"
              >
                Job Number{" "}
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">
                  (Optional)
                </span>
              </FieldLabel>
              <Input
                {...field}
                id="code"
                aria-invalid={fieldState.invalid}
                placeholder="e.g. MOA-001"
                autoComplete="off"
                disabled={pending}
                className="mt-1.5 dark:bg-zinc-800/50 dark:border-zinc-700/50 dark:text-white dark:placeholder-zinc-500"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="location"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel
                htmlFor="location"
                className="text-sm font-semibold text-zinc-700 dark:text-zinc-300"
              >
                Location{" "}
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">
                  (Optional)
                </span>
              </FieldLabel>
              <Input
                {...field}
                id="location"
                aria-invalid={fieldState.invalid}
                placeholder="e.g. Midrand, Gauteng"
                autoComplete="off"
                disabled={pending}
                className="mt-1.5 dark:bg-zinc-800/50 dark:border-zinc-700/50 dark:text-white dark:placeholder-zinc-500"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="address"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel
                htmlFor="address"
                className="text-sm font-semibold text-zinc-700 dark:text-zinc-300"
              >
                Address{" "}
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">
                  (Optional)
                </span>
              </FieldLabel>
              <Input
                {...field}
                id="address"
                aria-invalid={fieldState.invalid}
                placeholder="e.g. 123 Main Rd, Midrand, Gauteng"
                autoComplete="off"
                disabled={pending}
                className="mt-1.5 dark:bg-zinc-800/50 dark:border-zinc-700/50 dark:text-white dark:placeholder-zinc-500"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Pin Location{" "}
              <span className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">
                (Optional)
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-8 px-3 dark:border-zinc-700/50 dark:bg-zinc-800/50 dark:text-white dark:hover:bg-zinc-700/50"
                onClick={() => setPickerOpen((v) => !v)}
                disabled={pending}
              >
                {pickerOpen ? "Hide map" : "Pick on map"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-8 px-3 dark:border-zinc-700/50 dark:bg-zinc-800/50 dark:text-white dark:hover:bg-zinc-700/50"
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
                  <FieldLabel
                    htmlFor="latitude"
                    className="text-xs font-semibold text-zinc-600 dark:text-zinc-400"
                  >
                    Latitude
                  </FieldLabel>
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    id="latitude"
                    type="number"
                    step="0.000001"
                    inputMode="decimal"
                    aria-invalid={fieldState.invalid}
                    placeholder="-26.2041"
                    disabled={pending}
                    className="mt-1 dark:bg-zinc-800/50 dark:border-zinc-700/50 dark:text-white dark:placeholder-zinc-500"
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
                  <FieldLabel
                    htmlFor="longitude"
                    className="text-xs font-semibold text-zinc-600 dark:text-zinc-400"
                  >
                    Longitude
                  </FieldLabel>
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    id="longitude"
                    type="number"
                    step="0.000001"
                    inputMode="decimal"
                    aria-invalid={fieldState.invalid}
                    placeholder="28.0473"
                    disabled={pending}
                    className="mt-1 dark:bg-zinc-800/50 dark:border-zinc-700/50 dark:text-white dark:placeholder-zinc-500"
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
                Tip: click on the map to set the pin.
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
                  form.setValue("latitude", next.lat, { shouldValidate: true });
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
          className="flex-1 dark:border-zinc-700/50 dark:bg-zinc-800/50 dark:text-white dark:hover:bg-zinc-700/50"
          onClick={() => form.reset()}
          disabled={pending}
        >
          Reset
        </Button>
        <Button type="submit" disabled={pending} className="flex-1 gap-2">
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            "Create Site"
          )}
        </Button>
      </div>
    </form>
  );
}
