"use client";

import { toast } from "react-toastify";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod";
import { useState, useTransition } from "react";
import { Spinner } from "@/components/ui/spinner";

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
  defaultDayRate: z
    .string()
    .min(1, "Day rate is required.")
    .refine((v) => {
      const n = Number(String(v).replace(",", "."));
      return Number.isFinite(n) && n > 0;
    }, "Day rate must be a number > 0."),
  faceImageUrl: z.string().max(500, "Max 500 characters.").optional(),
});

export default function CreateEmployeeForm() {
  const [pending, startTransition] = useTransition();
  const [lastQr, setLastQr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const form = useForm<z.infer<typeof employeeSchema>>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      defaultDayRate: "",
      faceImageUrl: "",
    },
  });

  function resetFormAndState() {
    form.reset({
      firstName: "",
      lastName: "",
      defaultDayRate: "",
      faceImageUrl: "",
    });
    setLastQr(null);
  }

  function onSubmit(values: z.infer<typeof employeeSchema>) {
    startTransition(async () => {
      const res = await createEmployee({
        firstName: values.firstName,
        lastName: values.lastName,
        defaultDayRate: values.defaultDayRate,
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
                name="defaultDayRate"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="defaultDayRate">
                      Default day rate
                    </FieldLabel>
                    <Input
                      {...field}
                      id="defaultDayRate"
                      aria-invalid={fieldState.invalid}
                      placeholder="e.g. 450.00"
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
                      Face image URL (optional)
                    </FieldLabel>
                    <Input
                      {...field}
                      id="faceImageUrl"
                      aria-invalid={fieldState.invalid}
                      placeholder="Later: upload -> store URL here"
                      autoComplete="off"
                    />
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
