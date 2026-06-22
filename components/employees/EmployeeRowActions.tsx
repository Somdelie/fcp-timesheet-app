"use client";

import Link from "next/link";
import { useState } from "react";
import {
  MoreHorizontal,
  Eye,
  Download,
  Trash2,
  CircleOff,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/common/ConfirmationDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Sanitise for filename */
function safeFilename(first: string, last: string) {
  return `${first}_${last}`.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_");
}

export default function EmployeeRowActions({
  id,
  firstName,
  lastName,
  qrCodeValue,
  isActive,
  onChanged,
}: {
  id: string;
  firstName: string;
  lastName: string;
  qrCodeValue: string;
  isActive: boolean;
  onChanged?: () => void | Promise<void>;
}) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/employees/${id}`, { method: "DELETE" });
      if (res.ok) {
        setShowDeleteDialog(false);
        await onChanged?.();
        return;
      }
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Failed to delete employee");
    } catch (error) {
      console.error("Delete error:", error);
      alert("Failed to delete employee");
    } finally {
      setIsDeleting(false);
    }
  };

  /** Download card with folder-picker when supported */
  const handleDownloadCard = async () => {
    setIsDownloading(true);
    try {
      const filename = `${safeFilename(firstName, lastName)}_Card.pdf`;
      const res = await fetch(`/api/employees/${id}/card.pdf`);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();

      // Try File System Access API (lets user pick folder)
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
          // User cancelled or API not available – fall through
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
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Row actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem asChild>
            <Link href={`/employees/${id}`} className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              View
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem
            className="flex items-center gap-2"
            disabled={isDownloading}
            onSelect={(e) => {
              e.preventDefault();
              handleDownloadCard();
            }}
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download Card
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {!isActive && (
            <div className="px-2 py-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <CircleOff className="h-3.5 w-3.5" />
                Inactive
              </span>
            </div>
          )}

          <DropdownMenuItem
            className="flex items-center gap-2 text-red-600 focus:text-red-600"
            onSelect={(e) => {
              e.preventDefault();
              setShowDeleteDialog(true);
            }}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Employee?"
        description="This action will mark the employee as inactive. They can be reactivated later if needed."
        onConfirm={handleDelete}
        isLoading={isDeleting}
        confirmText="Delete"
        variant="destructive"
      >
        <p className="text-sm font-medium">QR Code: {qrCodeValue}</p>
      </ConfirmationDialog>
    </>
  );
}
