"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useBreadcrumbs } from "@/lib/breadcrumb-context";
import { useEffect, useState, useCallback } from "react";
import { Download, Loader2 } from "lucide-react";
import EditEmployeeForm from "@/components/employees/EditEmployeeForm";
import PromoteEmployeeDialog from "@/components/employees/PromoteEmployeeDialog";
import { getCompanySettings } from "@/actions/company-settings";

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  qrCodeValue: string;
  defaultDayRate: string | null;
  faceImageUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdByRole?: string | null;
  userId?: string | null;
  linkedForemanId?: string | null;
  isForeman?: boolean;
  foremanLinks?: Array<{
    foremanId: string;
    reason?: string | null;
    foreman: {
      id: string;
      user: {
        name?: string | null;
      };
    };
  }>;
}

export function EmployeeDetailContent({ employee }: { employee: Employee }) {
  const { setBreadcrumbs } = useBreadcrumbs();
  const [companyDefaultRate, setCompanyDefaultRate] = useState<string | null>(
    null,
  );
  const [showImageModal, setShowImageModal] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    setBreadcrumbs([
      { label: "Dashboard", href: "/" },
      { label: "Employees", href: "/employees" },
      { label: `${employee.firstName} ${employee.lastName}` },
    ]);
  }, [employee, setBreadcrumbs]);

  // Load company settings to show default rate
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await getCompanySettings();
        if (res.ok) {
          setCompanyDefaultRate(res.settings.defaultEmployeeDayRate);
        }
      } catch (err) {
        console.error("Failed to load company settings:", err);
      }
    };

    loadSettings();
  }, []);

  // Determine effective day rate
  const effectiveRate = employee.defaultDayRate || companyDefaultRate;
  const isUsingCompanyDefault = !employee.defaultDayRate;

  /** Download card with Save-As file picker when supported */
  const handleDownloadCard = useCallback(async () => {
    setIsDownloading(true);
    try {
      const safeName = `${employee.firstName}_${employee.lastName}`
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .replace(/_+/g, "_");
      const filename = `${safeName}_Card.pdf`;

      const res = await fetch(`/api/employees/${employee.id}/card.pdf`);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();

      // Try File System Access API (lets user pick folder/name)
      if ("showSaveFilePicker" in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: filename,
            types: [
              {
                description: "PDF Document",
                accept: { "application/pdf": [".pdf"] },
              },
            ],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          setIsDownloading(false);
          return;
        } catch {
          // User cancelled – fall through to normal download
        }
      }

      // Fallback: normal browser download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Download error:", err);
      alert("Failed to download card");
    } finally {
      setIsDownloading(false);
    }
  }, [employee]);

  return (
    <div className="mx-auto max-w-7xl p-4 ">
      <div className="rounded border bg-background p-6">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div
              className="flex h-20 w-20 items-center justify-center overflow-hidden rounded border bg-muted text-lg font-medium cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => employee.faceImageUrl && setShowImageModal(true)}
              title={
                employee.faceImageUrl ? "Click to view full image" : undefined
              }
            >
              {employee.faceImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={employee.faceImageUrl}
                  alt={`${employee.firstName} ${employee.lastName}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex items-center justify-center h-full w-full uppercase text-2xl text-muted-foreground bg-orange-700">
                  {employee.firstName[0]}
                  {employee.lastName[0]}
                </span>
              )}
            </div>

            {/* Info */}
            <div>
              <h1 className="text-2xl font-semibold">
                {employee.firstName} {employee.lastName}
              </h1>
              <div className="mt-2 flex flex-wrap gap-2">
                {employee.isForeman && <Badge variant="default">Foreman</Badge>}
                {!employee.isForeman && (
                  <Badge variant="secondary">Individual</Badge>
                )}
                {!employee.isActive && (
                  <Badge variant="destructive">Inactive</Badge>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleDownloadCard}
              disabled={isDownloading}
              className="gap-1.5"
            >
              {isDownloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {isDownloading ? "Downloading…" : "Download Card"}
            </Button>

            <EditEmployeeForm employee={employee} />

            <PromoteEmployeeDialog
              employeeId={employee.id}
              employeeName={`${employee.firstName} ${employee.lastName}`}
              employeePhoto={employee.faceImageUrl}
              isAlreadyForeman={!!employee.userId}
            />
          </div>
        </div>

        {/* Details Grid */}
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            {/* QR Code */}
            <div className="rounded border bg-muted/30 p-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                QR CODE
              </p>
              <p className="font-mono text-lg font-medium">
                {employee.qrCodeValue}
              </p>
            </div>

            {/* Day Rate */}
            <div className="rounded border bg-muted/30 p-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                DAY RATE
              </p>
              <p className="text-lg font-medium">
                {effectiveRate ? `R ${effectiveRate}` : "Not set"}
              </p>
              {isUsingCompanyDefault && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Using company default
                </p>
              )}
            </div>
          </div>

          {/* Foreman Links Section */}
          {employee.foremanLinks && employee.foremanLinks.length > 0 && (
            <div className="border-t pt-6">
              <h2 className="mb-4 text-sm font-semibold">Foreman Assignment</h2>
              <div className="space-y-2">
                {employee.foremanLinks.map((link) => (
                  <div
                    key={link.foremanId}
                    className="rounded border bg-muted/30 p-3 flex justify-between items-center"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {link.foreman.user.name || "Foreman"}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        Assigned: {link.reason || "unknown"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Additional Info */}
          <div className="border-t pt-6">
            <h2 className="mb-4 text-sm font-semibold">
              Additional Information
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">CREATED</p>
                <p className="mt-1 font-medium">
                  {new Date(employee.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">LAST UPDATED</p>
                <p className="mt-1 font-medium">
                  {new Date(employee.updatedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full Image Modal */}
      {showImageModal && employee.faceImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setShowImageModal(false)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw]">
            <button
              onClick={() => setShowImageModal(false)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 text-lg font-medium"
            >
              ✕ Close
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={employee.faceImageUrl}
              alt={`${employee.firstName} ${employee.lastName}`}
              className="max-h-[85vh] max-w-full rounded object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <p className="mt-2 text-center text-white text-sm">
              {employee.firstName} {employee.lastName}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
