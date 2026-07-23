"use client";

import * as React from "react";
import { Loader2, PackageOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import PlantDeployPOS, {
  PlantItemDto,
  PlantSiteDto,
  PlantSupervisorDto,
} from "../orders/PlantDeployPOS";

type DeploymentData = {
  supervisors: PlantSupervisorDto[];
  items: PlantItemDto[];
  sites: PlantSiteDto[];
};

interface PlantDeployDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeployed?: () => void;
}

export function PlantDeployDialog({
  open,
  onOpenChange,
  onDeployed,
}: PlantDeployDialogProps) {
  const [data, setData] = React.useState<DeploymentData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        "/api/app/admin/plant-assignments/deployment-options",
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        },
      );

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          json?.error ?? "Failed to load plant deployment information",
        );
      }

      setData({
        supervisors: Array.isArray(json?.supervisors) ? json.supervisors : [],
        items: Array.isArray(json?.items) ? json.items : [],
        sites: Array.isArray(json?.sites) ? json.sites : [],
      });
    } catch (cause) {
      console.error(cause);

      setError(
        cause instanceof Error
          ? cause.message
          : "Failed to load plant deployment information",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (open) {
      void loadData();
    }
  }, [open, loadData]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Deploy plant"
    >
      <div className="flex max-h-[96vh] w-full max-w-375 flex-col overflow-hidden rounded border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b bg-card px-4 py-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <PackageOpen className="h-5 w-5 text-primary" />
              Deploy Plant
            </h2>

            <p className="mt-0.5 text-xs text-muted-foreground">
              Select a supervisor and deploy multiple plant items.
            </p>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            aria-label="Close deployment window"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex min-h-125 items-center justify-center">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading deployment information...
              </div>
            </div>
          ) : error ? (
            <div className="flex min-h-125 flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-sm font-medium text-destructive">{error}</p>

              <Button type="button" variant="outline" onClick={loadData}>
                Try again
              </Button>
            </div>
          ) : data ? (
            <PlantDeployPOS
              supervisors={data.supervisors}
              items={data.items}
              allSites={data.sites}
              onDeployed={() => {
                onDeployed?.();
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
