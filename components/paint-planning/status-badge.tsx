import type { TdsImportStatus } from "@/types/tds-types";

const STATUS_CONFIG: Record<
  TdsImportStatus,
  { label: string; dot: string; text: string; bg: string }
> = {
  uploaded: {
    label: "Uploaded",
    dot: "bg-ink-faint",
    text: "text-ink-muted",
    bg: "bg-ink/5",
  },
  extracting: {
    label: "Extracting",
    dot: "bg-ink-faint",
    text: "text-ink-muted",
    bg: "bg-ink/5",
  },
  parsing: {
    label: "Parsing",
    dot: "bg-ink-faint",
    text: "text-ink-muted",
    bg: "bg-ink/5",
  },
  "needs-review": {
    label: "Needs review",
    dot: "bg-warning",
    text: "text-warning",
    bg: "bg-warning-soft",
  },
  approved: {
    label: "Approved",
    dot: "bg-success",
    text: "text-success",
    bg: "bg-success-soft",
  },
  imported: {
    label: "Imported",
    dot: "bg-success",
    text: "text-success",
    bg: "bg-success-soft",
  },
  failed: {
    label: "Failed",
    dot: "bg-danger",
    text: "text-danger",
    bg: "bg-danger-soft",
  },
};

export function StatusBadge({
  status,
}: {
  status: TdsImportStatus;
}) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${config.bg} ${config.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
