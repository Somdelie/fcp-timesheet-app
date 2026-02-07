"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmationDialog } from "@/components/common/ConfirmationDialog";

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
      const res = await fetch(`/api/employees/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setShowDeleteDialog(false);
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete employee");
      }
    } catch (error) {
      console.error("Delete error:", error);
      alert("Failed to delete employee");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        <Button asChild variant="outline">
          <Link href={`/employees/${id}`}>View</Link>
        </Button>

        <Button asChild variant="outline">
          <Link href={`/api/employees/${id}/card.pdf`} download>
            Download Card
          </Link>
        </Button>

        <Button
          variant="destructive"
          size="sm"
          onClick={() => setShowDeleteDialog(true)}
          disabled={isDeleting}
        >
          Delete
        </Button>

        {!isActive && (
          <span className="rounded-full border px-2 py-1 text-xs text-muted-foreground">
            Inactive
          </span>
        )}
      </div>

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
