"use client";

import { useState } from "react";
import type { TdsFile, TdsCoverageProfile } from "@/types/tds-types";
import { ConfidenceStamp } from "./confidence-stamp";
import { getRateDisplay } from "@/lib/paint-tds/rate-display";

interface ReviewPanelProps {
  file: TdsFile;
  onBack: () => void;
  onApprove: (id: string) => void;
}

function formatPackSizes(file: TdsFile): string {
  if (file.packSizes.length) {
    return file.packSizes.map((packSize) => packSize.label).join(", ");
  }
  const packSizes = file.packSizesLitres;
  if (!packSizes.length) return "Not detected";
  return packSizes.map((size) => `${size} L`).join(", ");
}

function formatBasis(profile: TdsCoverageProfile): string {
  if (profile.coverageBasis === "PER_COAT") return "Per coat";
  if (profile.coverageBasis === "TOTAL_SYSTEM") return "Total system";
  return "Basis not detected";
}

function formatCoats(profile: TdsCoverageProfile): string {
  if (profile.recommendedCoats === null) return "Coats not detected";
  return `${profile.recommendedCoats} ${
    profile.recommendedCoats === 1 ? "coat" : "coats"
  }`;
}

export function ReviewPanel({
  file,
  onBack,
  onApprove,
}: ReviewPanelProps) {
  const [approved, setApproved] = useState(file.status === "imported");

  const lowConfidenceCount = file.profiles.filter(
    (profile) =>
      profile.confidence !== null &&
      profile.confidence * 100 < 75,
  ).length;

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path
            d="M15 18l-6-6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Extraction queue
      </button>

      <div className="rounded-lg border border-line bg-surface p-6">
        <p className="text-xs uppercase tracking-wide text-ink-muted">
          {file.fileName}
        </p>

        <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-ink-muted">Product code</dt>
            <dd className="font-mono text-sm font-medium text-ink">
              {file.productCode ?? "Not detected"}
            </dd>
          </div>

          <div>
            <dt className="text-xs text-ink-muted">Product name</dt>
            <dd className="text-sm font-medium text-ink">
              {file.productName ?? "Not detected"}
            </dd>
          </div>

          <div>
            <dt className="text-xs text-ink-muted">Pack size</dt>
            <dd className="font-mono text-sm font-medium text-ink">
              {formatPackSizes(file)}
            </dd>
          </div>
        </dl>
      </div>

      {lowConfidenceCount > 0 && (
        <div className="mt-4 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
          {lowConfidenceCount} profile
          {lowConfidenceCount === 1 ? "" : "s"} scored below 75% confidence.
          Check the spreading rate and coat count against the source PDF before
          approving.
        </div>
      )}

      <div className="mt-6 space-y-3">
        {file.profiles.map((profile) => {
          const rateDisplay = getRateDisplay(profile);
          const confidencePercent =
            profile.confidence === null
              ? 0
              : Math.round(profile.confidence * 100);

          return (
            <div
              key={profile.id}
              className="flex items-center gap-4 rounded-lg border border-line bg-surface p-4"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M5 13l4 4L19 7"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">
                  {profile.name}
                </p>
                <p className="mt-1 text-xs font-medium text-ink">
                  {rateDisplay.label}: {rateDisplay.value}
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {rateDisplay.description}
                  <span className="mx-1.5 text-line">|</span>
                  {formatBasis(profile)}
                  <span className="mx-1.5 text-line">|</span>
                  {formatCoats(profile)}
                </p>
                {profile.applicationMethods.length > 0 && (
                  <p className="mt-1 text-xs text-ink-muted">
                    {profile.applicationMethods.map((method) => `\u2713 ${method}`).join("  ")}
                  </p>
                )}
                {profile.sourceSnippet && (
                  <details className="mt-2 text-xs text-ink-muted">
                    <summary className="cursor-pointer font-medium">
                      Extraction evidence
                    </summary>
                    <blockquote className="mt-1 border-l-2 border-line pl-3">
                      {profile.sourceSnippet}
                    </blockquote>
                  </details>
                )}
              </div>

              <ConfidenceStamp confidence={confidencePercent} />
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex items-center justify-end gap-3 border-t border-line pt-5">
        {approved && (
          <span className="text-sm font-medium text-success">
            Imported to product library
          </span>
        )}

        <button
          type="button"
          disabled={approved}
          onClick={() => {
            setApproved(true);
            onApprove(file.id);
          }}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:bg-ink-faint"
        >
          {approved ? "Approved" : "Approve and import"}
        </button>
      </div>
    </div>
  );
}
