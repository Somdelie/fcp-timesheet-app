"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Eye, Download, Trash2, CircleOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/common/ConfirmationDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function EmployeeRowActions({
  id,
  qrCodeValue,
  isActive,
}: {
  id: string;
  qrCodeValue: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/employees/${id}`, { method: "DELETE" });
      if (res.ok) {
        setShowDeleteDialog(false);
        router.refresh();
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

          <DropdownMenuItem asChild>
            <Link
              href={`/api/employees/${id}/card.pdf`}
              className="flex items-center gap-2"
              download
            >
              <Download className="h-4 w-4" />
              Download Card
            </Link>
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
