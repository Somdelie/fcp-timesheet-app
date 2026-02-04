"use client";

import Link from "next/link";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";

export default function EmployeeRowActions({
  id,
  qrCodeValue,
  isActive,
}: {
  id: string;
  qrCodeValue: string;
  isActive: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 md:justify-end">
      <Button asChild variant="outline">
        <Link href={`/employees/${id}/card`}>Card</Link>
      </Button>

      <Button
        type="button"
        variant="outline"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(qrCodeValue);
            toast.success("QR copied");
          } catch {
            toast.error("Failed to copy");
          }
        }}
      >
        Copy QR
      </Button>

      {!isActive && (
        <span className="rounded-full border px-2 py-1 text-xs text-muted-foreground">
          Inactive
        </span>
      )}
    </div>
  );
}
