function stampColor(confidence: number) {
  if (confidence >= 90) return { ring: "border-success/40", text: "text-success" };
  if (confidence >= 75) return { ring: "border-warning/50", text: "text-warning" };
  return { ring: "border-danger/50", text: "text-danger" };
}

export function ConfidenceStamp({ confidence }: { confidence: number }) {
  const { ring, text } = stampColor(confidence);
  return (
    <div
      className={`flex h-12 w-12 shrink-0 -rotate-3 items-center justify-center rounded-full border-2 border-dashed ${ring} bg-surface`}
      aria-label={`Confidence ${confidence} percent`}
    >
      <span className={`font-mono text-[13px] font-semibold leading-none ${text}`}>
        {confidence}%
      </span>
    </div>
  );
}
