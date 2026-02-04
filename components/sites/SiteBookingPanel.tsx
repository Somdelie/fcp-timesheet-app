"use client";

import * as React from "react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, Clock, Lock, Loader2 } from "lucide-react";
import { bookForemanForDay, listSiteDays } from "@/actions/sites";

interface SiteDay {
  id: string;
  workDate: string;
  foremanName?: string;
  isLocked: boolean;
}

function Card({
  title,
  description,
  children,
  icon: Icon,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/50 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/40 backdrop-blur-sm p-6 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center gap-3 mb-6">
        {Icon && <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              {description}
            </p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

export default function SiteBookingPanel({ siteId }: { siteId: string }) {
  const [foremanId, setForemanId] = React.useState("");
  const [workDate, setWorkDate] = React.useState("");
  const [rows, setRows] = React.useState<SiteDay[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [booking, setBooking] = React.useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const res = await listSiteDays({ siteId });
      setRows(res.ok ? res.siteDays : []);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    refresh();
  }, [siteId]);

  const handleBook = async () => {
    if (!foremanId.trim()) {
      toast.error("Please enter a foreman ID");
      return;
    }
    if (!workDate.trim()) {
      toast.error("Please select a work date");
      return;
    }

    setBooking(true);
    try {
      const res = await bookForemanForDay({
        siteId,
        foremanId,
        workDate,
      });

      if (!res.ok) {
        toast.error(res.error || "Failed to book foreman");
        return;
      }

      toast.success("Foreman booked successfully");
      setForemanId("");
      setWorkDate("");
      await refresh();
    } finally {
      setBooking(false);
    }
  };

  return (
    <Card
      title="Book Foreman"
      description="Assign foreman to site days"
      icon={Calendar}
    >
      <div className="space-y-6">
        {/* Booking Controls */}
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
              Foreman ID
            </label>
            <Input
              value={foremanId}
              onChange={(e) => setForemanId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleBook();
              }}
              placeholder="Enter foreman ID"
              disabled={booking}
              className="dark:bg-slate-800/50 dark:border-slate-700/50 dark:text-white dark:placeholder-slate-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
              Work Date
            </label>
            <Input
              type="date"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleBook();
              }}
              disabled={booking}
              className="dark:bg-slate-800/50 dark:border-slate-700/50 dark:text-white"
            />
          </div>
          <div className="flex flex-col justify-end">
            <Button onClick={handleBook} disabled={booking} className="gap-2">
              {booking ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Booking...
                </>
              ) : (
                "Book Foreman"
              )}
            </Button>
          </div>
        </div>

        {/* Bookings List */}
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
            Booked Days
          </h3>

          {loading ? (
            <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-300 dark:border-slate-700 py-8">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Loading...
              </p>
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/20 p-8 text-center">
              <Calendar className="mx-auto h-8 w-8 text-slate-400 dark:text-slate-600 mb-2" />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                No bookings yet. Book a foreman to get started.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="group rounded-xl border border-slate-200/30 dark:border-slate-700/30 bg-linear-to-br from-slate-50/50 to-slate-100/30 dark:from-slate-800/20 dark:to-slate-900/20 p-4 transition-all hover:shadow-md hover:border-slate-300/50 dark:hover:border-slate-600/50"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <h4 className="font-semibold text-slate-900 dark:text-white">
                          {new Date(r.workDate).toLocaleDateString("en-US", {
                            weekday: "short",
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </h4>
                      </div>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                        {r.foremanName || "Assigned Foreman"}
                      </p>
                    </div>
                    {r.isLocked && (
                      <div className="flex items-center gap-1 rounded-full bg-amber-500/10 dark:bg-amber-500/20 px-2 py-1">
                        <Lock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                        <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                          Locked
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg bg-slate-100/40 dark:bg-slate-800/40 p-2">
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      SiteDay ID
                    </p>
                    <p className="mt-1 font-mono text-xs text-slate-700 dark:text-slate-300 break-all">
                      {r.id}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="rounded-lg border border-slate-200/50 dark:border-slate-700/50 bg-slate-50/30 dark:bg-slate-800/20 p-4">
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-slate-900 dark:text-slate-200">
              Booking Rules:
            </span>{" "}
            One foreman can only be booked once per site-day, and each site-day
            can have only one foreman assigned.
          </p>
        </div>
      </div>
    </Card>
  );
}
