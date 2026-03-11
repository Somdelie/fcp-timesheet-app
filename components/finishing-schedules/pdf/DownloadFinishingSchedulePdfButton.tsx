"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";

interface DownloadFinishingSchedulePdfButtonProps {
  scheduleId: string;
  label?: string;
}

export function DownloadFinishingSchedulePdfButton({
  scheduleId,
  label = "Download PDF",
}: DownloadFinishingSchedulePdfButtonProps) {
  const [loading, setLoading] = useState(false);

  function handleClick() {
    setLoading(true);
    window.open(
      `/api/finishing-schedules/${encodeURIComponent(scheduleId)}/pdf`,
      "_blank",
    );
    // Reset after a short delay – the PDF opens in a new tab
    setTimeout(() => setLoading(false), 2000);
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
        <FileDown className="mr-2 h-4 w-4" />
      )}
      {label}
    </Button>
  );
}
