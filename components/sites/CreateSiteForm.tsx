"use client";

import { toast } from "react-toastify";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createSite, getNextSiteCode, listSiteClients } from "@/actions/sites";
import SiteLocationPicker from "@/components/sites/SiteLocationPicker";
import { cn } from "@/lib/utils";

const NO_ASSIGNMENT = "__no_assignment__";

const siteSchema = z.object({
  name: z
    .string()
    .min(2, "Site name must be at least 2 characters.")
    .max(80, "Max 80 characters."),
  code: z.string().max(30, "Max 30 characters.").optional(),
  client: z.string().max(120, "Max 120 characters.").optional(),
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
  assignmentType: z.enum(["SUPERVISOR", "ADMIN"]),
  assignmentUserId: z.string().optional(),
});

interface CreateSiteFormProps {
  onSuccess?: () => void;
  supervisorOptions?: Array<{ id: string; name: string; email: string }>;
  adminOptions?: Array<{ id: string; name: string; email: string }>;
}

export default function CreateSiteForm({
  onSuccess,
  supervisorOptions = [],
  adminOptions = [],
}: CreateSiteFormProps) {
  const [pending, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);
  const [clientOptions, setClientOptions] = useState<string[]>([]);
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");

  const form = useForm<z.infer<typeof siteSchema>>({
    resolver: zodResolver(siteSchema),
    defaultValues: {
      name: "",
      code: "",
      client: "",
      location: "",
      address: "",
      latitude: undefined,
      longitude: undefined,
      assignmentType: "SUPERVISOR",
      assignmentUserId: "",
    },
  });

  const assignmentType = form.watch("assignmentType");
  const assigneeOptions =
    assignmentType === "ADMIN" ? adminOptions : supervisorOptions;
  const assigneeLabel =
    assignmentType === "ADMIN" ? "Admin / Office" : "Supervisor";

  const mergeClientOption = useCallback((clientName: string) => {
    const cleanClientName = clientName.trim().replace(/\s+/g, " ").toUpperCase();
    if (!cleanClientName) return;

    setClientOptions((prev) => {
      const exists = prev.some(
        (client) => client.toLowerCase() === cleanClientName.toLowerCase(),
      );
      if (exists) return prev;

      return [...prev, cleanClientName].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" }),
      );
    });
  }, []);

  const fillNextSiteCode = useCallback(async (force = false) => {
    const res = await getNextSiteCode();
    if (!res.ok || !res.code) return;
    const currentCode = form.getValues("code")?.trim();
    if (force || !currentCode) {
      form.setValue("code", res.code, { shouldDirty: false });
    }
  }, [form]);

  const loadClientOptions = useCallback(async () => {
    const res = await listSiteClients();
    if (!res.ok) return;
    setClientOptions(res.clients);
  }, []);

  function handleAddClient() {
    const clientName = newClientName.trim().replace(/\s+/g, " ").toUpperCase();
    if (!clientName) {
      toast.error("Client name is required.");
      return;
    }
    if (clientName.length > 120) {
      toast.error("Client name must be 120 characters or less.");
      return;
    }

    mergeClientOption(clientName);
    form.setValue("client", clientName, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setNewClientName("");
    setAddClientOpen(false);
  }

  useEffect(() => {
    void fillNextSiteCode();
    void loadClientOptions();
  }, [fillNextSiteCode, loadClientOptions]);

  function onSubmit(values: z.infer<typeof siteSchema>) {
    startTransition(async () => {
      const res = await createSite({
        name: values.name,
        code: values.code || null,
        client: values.client || null,
        location: values.location || null,
        address: values.address || null,
        latitude: values.latitude ?? null,
        longitude: values.longitude ?? null,
        isActive: true,
        assignmentType: values.assignmentUserId
          ? values.assignmentType
          : null,
        assignmentUserId: values.assignmentUserId || null,
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success(`Created site: ${res.site.name}`);
      form.reset({
        name: "",
        code: "",
        client: "",
        location: "",
        address: "",
        latitude: undefined,
        longitude: undefined,
        assignmentType: "SUPERVISOR",
        assignmentUserId: "",
      });
      await Promise.all([fillNextSiteCode(true), loadClientOptions()]);
      onSuccess?.();
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <FieldGroup className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <Controller
          name="code"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel
                htmlFor="code"
                className="text-sm font-semibold text-zinc-700 dark:text-zinc-300"
              >
                Job Number <span className="text-red-500">*</span>
              </FieldLabel>
              <Input
                {...field}
                id="code"
                aria-invalid={fieldState.invalid}
                placeholder="Next job number"
                autoComplete="off"
                disabled={pending}
                className="mt-1.5 dark:bg-zinc-800/50 dark:border-zinc-700/50 dark:text-white dark:placeholder-zinc-500"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
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
                placeholder="e.g. Ellipse Phase 3"
                autoComplete="off"
                disabled={pending}
                className="mt-1.5 dark:bg-zinc-800/50 dark:border-zinc-700/50 dark:text-white dark:placeholder-zinc-500"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="client"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel
                htmlFor="client"
                className="text-sm font-semibold text-zinc-700 dark:text-zinc-300"
              >
                Client{" "}
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">
                  (Optional)
                </span>
              </FieldLabel>
              <div className="mt-1.5 flex gap-2">
                <Popover open={clientOpen} onOpenChange={setClientOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={clientOpen}
                      aria-invalid={fieldState.invalid}
                      disabled={pending}
                      className={cn(
                        "min-w-0 flex-1 justify-between font-normal dark:bg-zinc-800/50 dark:border-zinc-700/50 dark:text-white",
                        !field.value && "text-muted-foreground",
                      )}
                    >
                      <span className="truncate">
                        {field.value || "Select client"}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search clients..." />
                      <CommandList>
                        <CommandEmpty>No client found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="__no_client__"
                            keywords={["none", "no client"]}
                            onSelect={() => {
                              field.onChange("");
                              setClientOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                !field.value ? "opacity-100" : "opacity-0",
                              )}
                            />
                            No client
                          </CommandItem>
                          {clientOptions.map((client) => (
                            <CommandItem
                              key={client}
                              value={client}
                              keywords={[client]}
                              onSelect={() => {
                                field.onChange(client);
                                setClientOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  field.value?.toLowerCase() ===
                                    client.toLowerCase()
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                              {client}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={pending}
                  onClick={() => setAddClientOpen(true)}
                  title="Add client"
                  aria-label="Add client"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
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
            <Field data-invalid={fieldState.invalid} className="col-span-2">
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

        <div className="col-span-2 grid grid-cols-1 gap-3 md:grid-cols-2">
          <Controller
            name="assignmentType"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel
                  htmlFor="assignmentType"
                  className="text-sm font-semibold text-zinc-700 dark:text-zinc-300"
                >
                  Managed By{" "}
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">
                    (Optional)
                  </span>
                </FieldLabel>
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    form.setValue("assignmentUserId", "", {
                      shouldValidate: true,
                    });
                  }}
                  disabled={pending}
                >
                  <SelectTrigger
                    id="assignmentType"
                    className="mt-1.5 dark:bg-zinc-800/50 dark:border-zinc-700/50 dark:text-white"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
                    <SelectItem value="ADMIN">Admin / Office</SelectItem>
                  </SelectContent>
                </Select>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            name="assignmentUserId"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel
                  htmlFor="assignmentUserId"
                  className="text-sm font-semibold text-zinc-700 dark:text-zinc-300"
                >
                  {assigneeLabel}
                </FieldLabel>
                <Select
                  value={field.value || NO_ASSIGNMENT}
                  onValueChange={(value) =>
                    field.onChange(value === NO_ASSIGNMENT ? "" : value)
                  }
                  disabled={pending}
                >
                  <SelectTrigger
                    id="assignmentUserId"
                    className="mt-1.5 dark:bg-zinc-800/50 dark:border-zinc-700/50 dark:text-white"
                  >
                    <SelectValue placeholder={`Select ${assigneeLabel}`} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_ASSIGNMENT}>
                      No assignment yet
                    </SelectItem>
                    <SelectGroup>
                      <SelectLabel>{assigneeLabel}</SelectLabel>
                      {assigneeOptions.length === 0 ? (
                        <SelectItem value="__no_assignees__" disabled>
                          No {assigneeLabel.toLowerCase()} users available
                        </SelectItem>
                      ) : (
                        assigneeOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.name}
                            {option.email ? ` (${option.email})` : ""}
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
        </div>

        <div className="col-span-2">
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

      <Dialog
        open={addClientOpen}
        onOpenChange={(open) => {
          setAddClientOpen(open);
          if (!open) setNewClientName("");
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Client</DialogTitle>
            <DialogDescription>
              Add a client to the list and select it for this site.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newClientName}
            onChange={(event) => setNewClientName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleAddClient();
              }
            }}
            placeholder="Client name"
            autoComplete="off"
            maxLength={120}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddClientOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleAddClient}>
              Add Client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
