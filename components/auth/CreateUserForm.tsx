"use client";

import { toast } from "react-toastify";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod";
import { useEffect, useState, useTransition } from "react";
import { Spinner } from "@/components/ui/spinner";

import { Button } from "@/components/ui/button";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createNewUser, getAllSupervisors } from "@/actions/user";
import { UserRole } from "@/lib/roles";

const createUserSchema = z
  .object({
    name: z
      .string()
      .min(2, "Name must be at least 2 characters.")
      .max(80, "Name must be at most 80 characters."),
    email: z
      .string()
      .min(3, "Email must be at least 3 characters.")
      .max(120, "Email must be at most 120 characters.")
      .email("Please enter a valid email."),
    role: z.enum(["ADMIN", "OFFICE", "SUPERVISOR", "FOREMAN"]),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(100, "Password must be at most 100 characters."),
    confirmPassword: z.string(),
    dayRate: z.string().optional(),
    supervisorId: z.string().optional(),
    isSheRep: z.boolean().optional(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })
  .refine((v) => v.role !== "FOREMAN" || (v.dayRate && Number(v.dayRate) > 0), {
    message: "Day rate is required for foremen and must be greater than 0.",
    path: ["dayRate"],
  })
  .refine((v) => v.role !== "FOREMAN" || v.supervisorId, {
    message: "Supervisor is required for foremen.",
    path: ["supervisorId"],
  });

export default function CreateUserForm() {
  const [pending, startTransition] = useTransition();
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [loadingSupervisors, setLoadingSupervisors] = useState(true);

  useEffect(() => {
    const fetchSupervisors = async () => {
      try {
        const data = await getAllSupervisors();
        setSupervisors(data || []);
      } catch (error) {
        console.error("Failed to load supervisors:", error);
        toast.error("Failed to load supervisors.");
      } finally {
        setLoadingSupervisors(false);
      }
    };

    fetchSupervisors();
  }, []);

  const form = useForm<z.infer<typeof createUserSchema>>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: "",
      email: "",
      role: "FOREMAN",
      password: "",
      confirmPassword: "",
      dayRate: "", // ✅ FIXED: Use empty string instead of undefined
      supervisorId: "", // ✅ FIXED: Use empty string instead of undefined
      isSheRep: false,
    },
  });

  function onSubmit(values: z.infer<typeof createUserSchema>) {
    startTransition(async () => {
      const res = await createNewUser({
        name: values.name,
        email: values.email,
        password: values.password,
        role: values.role as UserRole,
        dayRate: values.dayRate ? Number(values.dayRate) : undefined,
        supervisorId: values.supervisorId || undefined,
        isSheRep: values.isSheRep ?? false,
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success(`User created: ${res.user.email}`);
      form.reset({
        name: "",
        email: "",
        role: "FOREMAN",
        password: "",
        confirmPassword: "",
        dayRate: "", // ✅ FIXED: Reset to empty string
        supervisorId: "", // ✅ FIXED: Reset to empty string
        isSheRep: false,
      });
    });
  }

  const role = form.watch("role");

  return (
    <div className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto pr-4">
      <form id="create-user-form" onSubmit={form.handleSubmit(onSubmit)}>
        <FieldGroup>
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="name">Full name</FieldLabel>
                <Input
                  {...field}
                  id="name"
                  aria-invalid={fieldState.invalid}
                  placeholder="e.g. Cautious Ndlovu"
                  autoComplete="off"
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            name="email"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  {...field}
                  id="email"
                  aria-invalid={fieldState.invalid}
                  placeholder="you@example.com"
                  autoComplete="off"
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            name="role"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>Role</FieldLabel>

                <Select
                  value={field.value}
                  onValueChange={(v) => field.onChange(v)}
                  disabled={pending}
                >
                  <SelectTrigger aria-invalid={fieldState.invalid}>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Roles</SelectLabel>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="OFFICE">Office</SelectItem>
                      <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
                      <SelectItem value="FOREMAN">Foreman</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>

                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          {/* ✅ FIXED: Use role variable instead of form.watch() in condition */}
          {role === "FOREMAN" && (
            <>
              <Controller
                name="supervisorId"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Supervisor</FieldLabel>

                    <Select
                      value={field.value}
                      onValueChange={(v) => field.onChange(v)}
                      disabled={pending || loadingSupervisors}
                    >
                      <SelectTrigger aria-invalid={fieldState.invalid}>
                        <SelectValue placeholder="Select a supervisor" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Supervisors</SelectLabel>
                          {loadingSupervisors ? (
                            <div className="px-2 py-1.5 text-sm text-gray-500">
                              Loading supervisors...
                            </div>
                          ) : supervisors.length === 0 ? (
                            <div className="px-2 py-1.5 text-sm text-gray-500">
                              No supervisors available
                            </div>
                          ) : (
                            supervisors.map((sup: any) => (
                              <SelectItem key={sup.id} value={sup.id}>
                                {sup.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectGroup>
                      </SelectContent>
                    </Select>

                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="dayRate"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="dayRate">Day Rate</FieldLabel>
                    <Input
                      {...field}
                      id="dayRate"
                      type="number"
                      step="0.01"
                      min="0"
                      aria-invalid={fieldState.invalid}
                      placeholder="e.g. 150.00"
                      autoComplete="off"
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="isSheRep"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <div className="flex items-center justify-between rounded border px-3.5 py-2.5">
                      <div>
                        <p className="text-sm font-medium">SheRep</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {field.value
                            ? "Will be displayed as SheRep"
                            : "Will be displayed as Foreman"}
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={!!field.value}
                        onClick={() => field.onChange(!field.value)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 ${
                          field.value
                            ? "bg-zinc-800 dark:bg-zinc-200"
                            : "bg-zinc-200 dark:bg-zinc-600"
                        }`}
                      >
                        <span
                          className={`pointer-events-none block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
                            field.value ? "translate-x-4" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>
                  </Field>
                )}
              />
            </>
          )}

          <Controller
            name="password"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  {...field}
                  type="password"
                  id="password"
                  aria-invalid={fieldState.invalid}
                  placeholder="Enter a strong password"
                  autoComplete="new-password"
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            name="confirmPassword"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="confirmPassword">
                  Confirm password
                </FieldLabel>
                <Input
                  {...field}
                  type="password"
                  id="confirmPassword"
                  aria-invalid={fieldState.invalid}
                  placeholder="Repeat the password"
                  autoComplete="new-password"
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
          onClick={() =>
            form.reset({
              name: "",
              email: "",
              role: "FOREMAN",
              password: "",
              confirmPassword: "",
              dayRate: "",
              supervisorId: "",
              isSheRep: false,
            })
          }
          disabled={pending}
        >
          Reset
        </Button>

        <Button type="submit" form="create-user-form" disabled={pending}>
          {pending ? (
            <span className="flex items-center gap-2">
              <Spinner />
              Creating...
            </span>
          ) : (
            "Create user"
          )}
        </Button>
      </Field>
    </div>
  );
}
