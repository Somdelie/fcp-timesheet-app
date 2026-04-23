"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Loader2 } from "lucide-react";

interface Props {
  scheduleId: string;
  label?: string;
}

export function DownloadFinishingScheduleExcelButton({
  scheduleId,
  label = "Download Excel",
}: Props) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/finishing-schedules/${encodeURIComponent(scheduleId)}/excel`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to generate Excel");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("content-disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      a.download = match?.[1] ?? "Finishing_Schedule.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silent – browser will show nothing downloaded
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />
      )}
      {label}
    </Button>
  );
}
