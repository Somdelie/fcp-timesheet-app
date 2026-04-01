"use client";
import { toast } from "react-toastify";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useTransition } from "react";
import { Spinner } from "../ui/spinner";
import { useRouter } from "next/navigation";

const loginSchema = z.object({
  email: z
    .string()
    .min(3, "Email must be at least 3 characters.")
    .max(62, "Email must be at most 32 characters."),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters.")
    .max(100, "Password must be at most 100 characters."),
});

export function LoginForm() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  function onSubmit(data: z.infer<typeof loginSchema>) {
    try {
      startTransition(async () => {
        const result = await signIn("credentials", {
          redirect: false,
          email: data.email,
          password: data.password,
          callbackUrl: "/",
        });

        if (result?.error) {
          toast.error("Invalid email or password.");
          return;
        }

        toast.success("Login successful!");
        router.push(result?.url || "/");
      });
    } catch (error) {
      console.log(error);
      toast.error("Login failed. Please try again.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form id="login-form" onSubmit={form.handleSubmit(onSubmit)}>
        <FieldGroup>
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
        <Button type="button" variant="outline" onClick={() => form.reset()}>
          Reset
        </Button>
        <Button type="submit" form="login-form">
          {pending ? (
            <span className="flex items-center gap-2">
              <Spinner />
              Loading...
            </span>
          ) : (
            "Log In"
          )}
        </Button>
      </Field>
    </div>
  );
}
