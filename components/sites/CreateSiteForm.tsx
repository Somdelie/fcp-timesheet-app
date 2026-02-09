"use client";

import { toast } from "react-toastify";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod";
import { useTransition } from "react";
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

const siteSchema = z.object({
  name: z
    .string()
    .min(2, "Site name must be at least 2 characters.")
    .max(80, "Max 80 characters."),
  code: z.string().max(30, "Max 30 characters.").optional(),
  location: z.string().max(120, "Max 120 characters.").optional(),
});

interface CreateSiteFormProps {
  onSuccess?: () => void;
}

export default function CreateSiteForm({ onSuccess }: CreateSiteFormProps) {
  const [pending, startTransition] = useTransition();

  const form = useForm<z.infer<typeof siteSchema>>({
    resolver: zodResolver(siteSchema),
    defaultValues: { name: "", code: "", location: "" },
  });

  function onSubmit(values: z.infer<typeof siteSchema>) {
    startTransition(async () => {
      const res = await createSite({
        name: values.name,
        code: values.code || null,
        location: values.location || null,
        isActive: true,
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success(`Created site: ${res.site.name}`);
      form.reset({ name: "", code: "", location: "" });
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
