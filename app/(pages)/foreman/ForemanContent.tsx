"use client";

import { useBreadcrumbs } from "@/lib/breadcrumb-context";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Foreman {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  foreman: {
    id: string;
    defaultDayRate: string | null;
    createdAt: string;
  } | null;
}

export function ForemanContent({ foremen }: { foremen: Foreman[] }) {
  const { setBreadcrumbs } = useBreadcrumbs();
  const [selectedForeman, setSelectedForeman] = useState<Foreman | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    setBreadcrumbs([{ label: "Dashboard", href: "/" }, { label: "Foremen" }]);
  }, [setBreadcrumbs]);

  const openDialog = (foreman: Foreman) => {
    setSelectedForeman(foreman);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setSelectedForeman(null);
  };

  return (
    <>
      <div className="mx-auto max-w-5xl p-4 md:p-6 space-y-4">
        {/* Header */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Foremen</h1>
            <p className="text-sm text-muted-foreground">
              Manage all foremen in the system.
            </p>
          </div>
          <Button asChild>
            <Link href="/users/new">+ Create Foreman</Link>
          </Button>
        </div>

        {/* List */}
        <div className="rounded-xl border bg-background">
          <div className="border-b p-3 text-sm text-muted-foreground">
            Showing{" "}
            <span className="font-medium text-foreground">
              {foremen.length}
            </span>{" "}
            foremen
          </div>

          {foremen.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              No foremen found.
            </div>
          ) : (
            <div className="divide-y">
              {foremen.map((foreman) => (
                <div
                  key={foreman.id}
                  className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between"
                >
                  {/* Left */}
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border bg-muted text-xs font-medium">
                      {foreman.name[0]}
                      {foreman.name.split(" ")[1]?.[0] || ""}
                    </div>

                    {/* Text */}
                    <div>
                      <div className="font-medium">{foreman.name}</div>

                      <div className="mt-1 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                        <span>{foreman.email}</span>

                        {foreman.foreman?.defaultDayRate && (
                          <span>
                            Default Rate:{" "}
                            <span className="font-medium text-foreground">
                              R {foreman.foreman.defaultDayRate}
                            </span>
                          </span>
                        )}
                      </div>

                      <div className="mt-1 text-xs text-muted-foreground">
                        Added {foreman.createdAt}
                      </div>
                    </div>
                  </div>

                  {/* Right - Actions */}
                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    <Button
                      variant="outline"
                      onClick={() => openDialog(foreman)}
                    >
                      View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dialog for viewing foreman details */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Foreman Details</DialogTitle>
          </DialogHeader>

          {selectedForeman && (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground">NAME</p>
                <p className="mt-1 font-medium">{selectedForeman.name}</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">EMAIL</p>
                <p className="mt-1 font-medium">{selectedForeman.email}</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">ROLE</p>
                <p className="mt-1 font-medium">{selectedForeman.role}</p>
              </div>

              {selectedForeman.foreman?.defaultDayRate && (
                <div>
                  <p className="text-xs text-muted-foreground">
                    DEFAULT DAY RATE
                  </p>
                  <p className="mt-1 font-medium">
                    R {selectedForeman.foreman.defaultDayRate}
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs text-muted-foreground">CREATED</p>
                <p className="mt-1 font-medium">{selectedForeman.createdAt}</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">FOREMAN CREATED</p>
                <p className="mt-1 font-medium">
                  {selectedForeman.foreman?.createdAt || "N/A"}
                </p>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={closeDialog}
                  className="flex-1"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
