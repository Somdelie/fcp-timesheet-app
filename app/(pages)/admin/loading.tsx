function AdminTableSkeleton() {
  return (
    <div className="overflow-hidden rounded border bg-card">
      <div className="grid h-11 grid-cols-[2fr_1fr_1fr_1fr_7rem] gap-4 bg-muted/70 px-4 py-3">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-3 animate-pulse rounded bg-muted-foreground/15" />
        ))}
      </div>
      {Array.from({ length: 9 }, (_, row) => (
        <div
          key={row}
          className="grid h-11 grid-cols-[2fr_1fr_1fr_1fr_7rem] items-center gap-4 border-t px-4"
        >
          {Array.from({ length: 5 }, (_, cell) => (
            <div
              key={cell}
              className="h-3 animate-pulse rounded bg-muted"
              style={{ width: `${55 + ((row + cell) % 4) * 10}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function AdminLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-4" aria-busy="true">
      <div className="flex h-10 items-center gap-3">
        <div className="h-9 flex-1 animate-pulse rounded bg-muted" />
        <div className="h-9 w-36 animate-pulse rounded bg-muted" />
        <div className="h-9 w-28 animate-pulse rounded bg-muted" />
      </div>
      <AdminTableSkeleton />
    </div>
  );
}
