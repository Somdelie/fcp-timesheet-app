"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import type { TdsCoverageProfile, TdsFile } from "@/types/tds-types";
import { getRateDisplay } from "@/lib/paint-tds/rate-display";

type SupplierOption = {
  id: string;
  name: string;
  supplierType: "BRAND" | "VENDOR";
  parentSupplierId: string | null;
};

type TdsReviewFile = TdsFile & {
  supplierId: string | null;
  supplier: {
    id: string;
    name: string;
    supplierType: "BRAND" | "VENDOR";
  } | null;
  suppliers: SupplierOption[];
};

const num = (value: string) => {
  if (value.trim() === "") {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
};

export default function TdsReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [file, setFile] = useState<TdsReviewFile | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/paint-tds/${id}`, {
      cache: "no-store",
    });

    const json = await response.json();

    if (!response.ok) {
      throw new Error(json.error ?? "Unable to load import.");
    }

    setFile(json as TdsReviewFile);
  }, [id]);

  useEffect(() => {
    void load().catch((loadError: unknown) => {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load import.",
      );
    });
  }, [load]);

  async function saveProduct(options?: { reload?: boolean }) {
    if (!file) {
      return false;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/admin/paint-tds/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          supplierId: file.supplierId,

          manufacturer: file.manufacturer,
          productCode: file.productCode,
          productName: file.productName,
          description: file.description,
          revision: file.revision,
          revisionDate: file.revisionDate,
          packSizesLitres: file.packSizesLitres,
          packSizes: file.packSizes,
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error ?? "Save failed.");
      }

      if (options?.reload !== false) {
        setFile(json as TdsReviewFile);
      }

      setSuccess("Product details saved.");

      return true;
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "Save failed.");

      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveProfile(profile: TdsCoverageProfile) {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `/api/admin/paint-tds/${id}/profiles/${profile.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(profile),
        },
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error ?? "Profile save failed.");
      }

      await load();

      setSuccess("Coverage profile saved.");
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error ? saveError.message : "Profile save failed.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function approve() {
    if (!file) {
      return;
    }

    setError(null);
    setSuccess(null);

    if (!file.supplierId) {
      setError("Select a supplier before approving this Paint TDS.");
      return;
    }

    if (!file.productName?.trim()) {
      setError("Enter a product name before approving this Paint TDS.");
      return;
    }

    setSaving(true);

    try {
      const productSaved = await saveProduct({
        reload: false,
      });

      if (!productSaved) {
        return;
      }

      const response = await fetch(`/api/admin/paint-tds/${id}/approve`, {
        method: "POST",
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error ?? "Approval failed.");
      }

      await load();

      setSuccess("Paint TDS approved and imported successfully.");
    } catch (approvalError: unknown) {
      setError(
        approvalError instanceof Error
          ? approvalError.message
          : "Approval failed.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!file) {
    return (
      <div className="p-8 text-sm text-slate-500">
        {error ?? "Loading review…"}
      </div>
    );
  }

  const brandSuppliers = file.suppliers.filter(
    (supplier) => supplier.supplierType === "BRAND",
  );

  const vendorSuppliers = file.suppliers.filter(
    (supplier) => supplier.supplierType === "VENDOR",
  );

  return (
    <div className="mx-auto w-full max-w-375 px-6 py-6">
      <button
        type="button"
        onClick={() => router.push("/admin/technical-data-sheets/")}
        className="mb-4 text-sm text-slate-600 hover:text-slate-900"
      >
        ← Technical Data Sheets
      </button>

      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-slate-500">{file.fileName}</p>

          <h1 className="mt-1 text-2xl font-semibold">Review extracted data</h1>
        </div>

        <span className="rounded-full border px-3 py-1 text-xs capitalize">
          {file.status.replaceAll("-", " ")}
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {file.warnings.length > 0 && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {file.warnings.map((warning) => (
            <p key={warning}>• {warning}</p>
          ))}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.4fr]">
        <section className="rounded-lg border bg-white p-5">
          <h2 className="font-semibold">Product information</h2>

          <div className="mt-4 grid gap-3">
            <label className="text-xs text-slate-500">
              Supplier / brand
              <select
                value={file.supplierId ?? ""}
                onChange={(event) =>
                  setFile({
                    ...file,
                    supplierId: event.target.value || null,
                  })
                }
                className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900"
              >
                <option value="">Select supplier…</option>

                {brandSuppliers.length > 0 && (
                  <optgroup label="Brands">
                    {brandSuppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </optgroup>
                )}

                {vendorSuppliers.length > 0 && (
                  <optgroup label="Vendors">
                    {vendorSuppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <span className="mt-1 block text-[11px] text-slate-400">
                Select the product brand where possible, for example Plascon,
                Dulux or Marmoran.
              </span>
            </label>

            {(
              [
                ["Manufacturer", "manufacturer"],
                ["Product code", "productCode"],
                ["Product name", "productName"],
                ["Revision", "revision"],
              ] as const
            ).map(([label, key]) => (
              <label key={key} className="text-xs text-slate-500">
                {label}

                <input
                  value={file[key] ?? ""}
                  onChange={(event) =>
                    setFile({
                      ...file,
                      [key]: event.target.value || null,
                    })
                  }
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm text-slate-900"
                />
              </label>
            ))}

            <label className="text-xs text-slate-500">
              Revision date
              <input
                type="date"
                value={file.revisionDate?.slice(0, 10) ?? ""}
                onChange={(event) =>
                  setFile({
                    ...file,
                    revisionDate: event.target.value || null,
                  })
                }
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
            </label>

            <label className="text-xs text-slate-500">
              Pack sizes (comma-separated, include L or kg)
              <input
                defaultValue={file.packSizes
                  .map((packSize) => packSize.label)
                  .join(", ")}
                onChange={(event) => {
                  const packSizes = event.target.value
                    .split(",")
                    .map((value) => {
                      const match = value.trim().match(/^(\d+(?:[.,]\d+)?)\s*(kg|l)$/i);
                      if (!match) return null;
                      const quantity = Number(match[1].replace(",", "."));
                      const uom = match[2].toUpperCase() === "KG" ? "KG" : "L";
                      if (!Number.isFinite(quantity) || quantity <= 0) return null;
                      return {
                        quantity,
                        uom: uom as "L" | "KG",
                        label: `${quantity} ${uom === "KG" ? "kg" : "L"}`,
                      };
                    })
                    .filter((value) => value !== null);
                  setFile({
                    ...file,
                    packSizes,
                    packSizesLitres: packSizes
                      .filter((packSize) => packSize.uom === "L")
                      .map((packSize) => packSize.quantity),
                  });
                }}
                placeholder="Example: 1 L, 5 L, 20 L or 8 kg, 32 kg"
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
            </label>

            <label className="text-xs text-slate-500">
              Description
              <textarea
                value={file.description ?? ""}
                onChange={(event) =>
                  setFile({
                    ...file,
                    description: event.target.value || null,
                  })
                }
                className="mt-1 min-h-24 w-full rounded-md border px-3 py-2 text-sm"
              />
            </label>

            <button
              type="button"
              disabled={saving}
              onClick={() => void saveProduct()}
              className="rounded-md border px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save product details"}
            </button>
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Coverage profiles</h2>

            <span className="text-xs text-slate-500">
              {file.profiles.length} extracted
            </span>
          </div>

          <div className="space-y-4">
            {file.profiles.map((profile, index) => {
              const rateDisplay = getRateDisplay(profile);
              const mutate = <Key extends keyof TdsCoverageProfile>(
                key: Key,
                value: TdsCoverageProfile[Key],
              ) => {
                setFile({
                  ...file,
                  profiles: file.profiles.map((item) =>
                    item.id === profile.id
                      ? {
                          ...item,
                          [key]: value,
                        }
                      : item,
                  ),
                });
              };

              return (
                <div
                  key={profile.id}
                  className={`rounded-lg border bg-white p-5 ${
                    profile.confidence != null && profile.confidence < 0.75
                      ? "border-amber-300"
                      : ""
                  }`}
                >
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <input
                      value={profile.name}
                      onChange={(event) => mutate("name", event.target.value)}
                      className="w-full max-w-md border-0 p-0 text-base font-semibold outline-none"
                    />

                    <span className="whitespace-nowrap text-xs text-slate-500">
                      Confidence{" "}
                      {profile.confidence == null
                        ? "—"
                        : `${Math.round(profile.confidence * 100)}%`}
                    </span>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Select
                      label="Rate unit"
                      description={rateDisplay.description}
                      value={profile.rateUnit ?? ""}
                      options={[
                        { value: "M2_PER_L", label: "Coverage - m²/L" },
                        { value: "M2_PER_KG", label: "Coverage - m²/kg" },
                        { value: "L_PER_M2", label: "Consumption - L/m²" },
                        { value: "KG_PER_M2", label: "Consumption - kg/m²" },
                        {
                          value: "M2_PER_CONTAINER",
                          label: "Container coverage - m²/container",
                        },
                      ]}
                      onChange={(value) =>
                        mutate(
                          "rateUnit",
                          (value as TdsCoverageProfile["rateUnit"]) || null,
                        )
                      }
                    />

                    <Field
                      label={`${rateDisplay.label} - minimum`}
                      description="Lower end of the manufacturer rate range."
                      value={profile.rateMin}
                      placeholder="Example: 8"
                      onChange={(value) => mutate("rateMin", num(value))}
                    />

                    <Field
                      label={`${rateDisplay.label} - maximum`}
                      description="Upper end of the manufacturer rate range."
                      value={profile.rateMax}
                      placeholder="Example: 10"
                      onChange={(value) => mutate("rateMax", num(value))}
                    />

                    <Select
                      label="Coverage basis"
                      description="Choose whether the coverage applies to one coat or the complete paint system."
                      value={profile.coverageBasis ?? ""}
                      options={[
                        {
                          value: "PER_COAT",
                          label: "Per coat",
                        },
                        {
                          value: "TOTAL_SYSTEM",
                          label: "Complete system",
                        },
                      ]}
                      onChange={(value) =>
                        mutate(
                          "coverageBasis",
                          (value as TdsCoverageProfile["coverageBasis"]) ||
                            null,
                        )
                      }
                    />

                    <Select
                      label="Coverage type"
                      description="Theoretical is calculated by the manufacturer. Practical allows for normal site losses."
                      value={profile.coverageType ?? ""}
                      options={[
                        {
                          value: "THEORETICAL",
                          label: "Theoretical — Manufacturer calculation",
                        },
                        {
                          value: "PRACTICAL",
                          label: "Practical — Expected on site",
                        },
                      ]}
                      onChange={(value) =>
                        mutate(
                          "coverageType",
                          (value as TdsCoverageProfile["coverageType"]) || null,
                        )
                      }
                    />

                    <Field
                      label="Number of coats"
                      description="How many full coats are required for this finish."
                      value={profile.recommendedCoats}
                      placeholder="Example: 2"
                      onChange={(value) =>
                        mutate("recommendedCoats", num(value))
                      }
                    />

                    <Field
                      label="Dry film thickness (DFT)"
                      description="Paint thickness after drying, measured in microns."
                      value={profile.recommendedDftMicrons}
                      placeholder="Example: 125"
                      onChange={(value) =>
                        mutate("recommendedDftMicrons", num(value))
                      }
                    />

                    <Field
                      label="Wet film thickness (WFT)"
                      description="Paint thickness immediately after application, before drying."
                      value={profile.recommendedWftMicrons}
                      placeholder="Example: 245"
                      onChange={(value) =>
                        mutate("recommendedWftMicrons", num(value))
                      }
                    />

                    <Field
                      label="Pack size in litres"
                      description="The size of one paint bucket or container."
                      value={profile.containerSizeLitres}
                      placeholder="Example: 20"
                      onChange={(value) =>
                        mutate("containerSizeLitres", num(value))
                      }
                    />

                    <Field
                      label="TDS source page"
                      description="The page where this application rate was found."
                      value={profile.sourcePage}
                      placeholder="Example: 2"
                      onChange={(value) => mutate("sourcePage", num(value))}
                    />

                    <label className="block text-xs text-slate-600">
                      <span className="block font-medium text-slate-700">
                        Application methods
                      </span>

                      <span className="mt-0.5 block min-h-8 text-[11px] leading-4 text-slate-400">
                        Separate multiple valid methods with commas.
                      </span>

                      <input
                        value={profile.applicationMethods.join(", ")}
                        placeholder="Example: Brush, roller, airless spray"
                        onChange={(event) =>
                          mutate(
                            "applicationMethods",
                            event.target.value
                              .split(",")
                              .map((value) => value.trim())
                              .filter(Boolean),
                          )
                        }
                        className="mt-1 w-full rounded-md border px-3 py-2 text-sm text-slate-900"
                      />
                    </label>
                  </div>

                  {(profile.manufacturerRateLabel || profile.sourceSnippet) && (
                    <div className="mt-4 rounded-md border bg-slate-50 p-3 text-xs text-slate-600">
                      <p className="font-medium text-slate-700">
                        {profile.manufacturerRateLabel ?? "Extraction evidence"}
                      </p>
                      {profile.sourceSnippet && (
                        <blockquote className="mt-1 border-l-2 border-slate-300 pl-3">
                          {profile.sourceSnippet}
                        </blockquote>
                      )}
                    </div>
                  )}

                  <div className="mt-3 flex gap-5 text-sm">
                    <label className="flex cursor-pointer items-start gap-2 rounded-md bg-slate-50 p-3">
                      <input
                        type="checkbox"
                        checked={profile.isSelected}
                        onChange={(event) =>
                          mutate("isSelected", event.target.checked)
                        }
                        className="mt-0.5"
                      />

                      <span>
                        <span className="block text-sm font-medium text-slate-700">
                          Import this product rate
                        </span>

                        <span className="block text-xs text-slate-500">
                          Compatible m²/L rates remain available for paint
                          calculations; other units are stored for their matching
                          product workflows.
                        </span>
                      </span>
                    </label>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void saveProfile(file.profiles[index])}
                      className="rounded-md border px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Save profile
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="mt-6 flex justify-end border-t pt-5">
        <button
          type="button"
          disabled={saving || file.status === "imported"}
          onClick={() => void approve()}
          className="rounded-md bg-green-600 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {file.status === "imported"
            ? "Imported"
            : saving
              ? "Importing…"
              : "Approve and import"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  description,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  description?: string;
  value: number | null;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-xs text-slate-600">
      <span className="block font-medium text-slate-700">{label}</span>

      {description && (
        <span className="mt-0.5 block min-h-8 text-[11px] leading-4 text-slate-400">
          {description}
        </span>
      )}

      <input
        type="number"
        step="any"
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border px-3 py-2 text-sm text-slate-900"
      />
    </label>
  );
}

type SelectOption = {
  value: string;
  label: string;
};

function Select({
  label,
  description,
  value,
  options,
  onChange,
}: {
  label: string;
  description?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-xs text-slate-600">
      <span className="block font-medium text-slate-700">{label}</span>

      {description && (
        <span className="mt-0.5 block min-h-8 text-[11px] leading-4 text-slate-400">
          {description}
        </span>
      )}

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900"
      >
        <option value="">Select…</option>

        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
