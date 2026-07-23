function SkeletonRow() {
  return (
    <div className="grid h-11 grid-cols-[2fr_1fr_1fr_7rem] items-center gap-4 border-t px-4">
      <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
      <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
      <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
      <div className="h-7 w-full animate-pulse rounded bg-muted" />
    </div>
  );
}

export default function PagesLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-4" aria-busy="true">
      <div className="flex h-10 items-center justify-between gap-4">
        <div className="h-6 w-48 animate-pulse rounded bg-muted" />
        <div className="h-9 w-28 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-24 animate-pulse rounded border bg-muted/60" />
        ))}
      </div>
      <div className="overflow-hidden rounded border bg-card">
        <div className="h-11 animate-pulse bg-muted/70" />
        {Array.from({ length: 8 }, (_, index) => (
          <SkeletonRow key={index} />
        ))}
      </div>
    </div>
  );
}
