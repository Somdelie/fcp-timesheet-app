"use client";

import * as React from "react";
import {
  ClipboardList,
  DollarSign,
  FileText,
  Loader2,
  Package,
  ReceiptText,
  TrendingUp,
  Users,
} from "lucide-react";
import { toast } from "react-toastify";

import { verifyTeamRateConfirmationCode } from "@/actions/company-settings";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type SiteDetailsSectionsProps = {
  assignments: React.ReactNode;
  dayRateOverrides?: React.ReactNode;
  documents: React.ReactNode;
  materials: React.ReactNode;
  materialOrders: React.ReactNode;
  projectCosts: React.ReactNode;
  finishingSchedule?: React.ReactNode;
};

const tabButtonClass =
  "h-8 flex-none gap-2 rounded-none border-0 bg-transparent px-4 py-1 text-sm font-medium text-muted-foreground shadow-none data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none dark:data-[state=active]:bg-transparent after:hidden [&_svg]:h-4 [&_svg]:w-4";

export default function SiteDetailsSections({
  assignments,
  dayRateOverrides,
  documents,
  materials,
  materialOrders,
  projectCosts,
  finishingSchedule,
}: SiteDetailsSectionsProps) {
  const [activeTab, setActiveTab] = React.useState("assignments");
  const [protectedTabsUnlocked, setProtectedTabsUnlocked] =
    React.useState(false);
  const [pendingProtectedTab, setPendingProtectedTab] = React.useState<
    "documents" | "day-rates" | null
  >(null);
  const [confirmationCode, setConfirmationCode] = React.useState("");
  const [confirmingCode, setConfirmingCode] = React.useState(false);
  const tabListRef = React.useRef<HTMLDivElement | null>(null);
  const [indicatorStyle, setIndicatorStyle] =
    React.useState<React.CSSProperties>({
      opacity: 0,
      transform: "translateX(0)",
      width: 0,
    });

  React.useLayoutEffect(() => {
    const tabList = tabListRef.current;
    if (!tabList) return;

    const updateIndicator = () => {
      const activeTrigger = tabList.querySelector<HTMLElement>(
        `[data-state="active"]`,
      );
      if (!activeTrigger) return;

      setIndicatorStyle({
        opacity: 1,
        transform: `translateX(${activeTrigger.offsetLeft}px)`,
        width: activeTrigger.offsetWidth,
      });
    };

    updateIndicator();

    const resizeObserver = new ResizeObserver(updateIndicator);
    resizeObserver.observe(tabList);
    for (const trigger of tabList.querySelectorAll(
      "[data-slot='tabs-trigger']",
    )) {
      resizeObserver.observe(trigger);
    }

    window.addEventListener("resize", updateIndicator);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateIndicator);
    };
  }, [activeTab, dayRateOverrides, finishingSchedule]);

  function handleTabChange(value: string) {
    if (
      (value === "documents" || value === "day-rates") &&
      !protectedTabsUnlocked
    ) {
      setPendingProtectedTab(value);
      setConfirmationCode("");
      return;
    }

    setActiveTab(value);
  }

  async function handleUnlockProtectedTab() {
    if (!pendingProtectedTab || !confirmationCode.trim()) return;

    setConfirmingCode(true);
    try {
      const res = await verifyTeamRateConfirmationCode({
        confirmationCode: confirmationCode.trim(),
      });

      if (!res.ok) {
        toast.error(res.error || "Invalid confirmation code.");
        return;
      }

      setProtectedTabsUnlocked(true);
      setActiveTab(pendingProtectedTab);
      setPendingProtectedTab(null);
      setConfirmationCode("");
    } catch {
      toast.error("Failed to verify confirmation code.");
    } finally {
      setConfirmingCode(false);
    }
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="gap-3">
      <div className="rounded border border-muted/50 bg-card p-4">
        <TabsList
          ref={tabListRef}
          variant="line"
          className="relative flex h-auto w-full flex-nowrap justify-start gap-1 overflow-visible rounded-none border-b border-border bg-transparent p-0"
        >
          <TabsTrigger value="assignments" className={tabButtonClass}>
            <Users className="h-4 w-4" />
            Assignments
          </TabsTrigger>
          <TabsTrigger value="materials" className={tabButtonClass}>
            <ClipboardList className="h-4 w-4" />
            Site Materials
          </TabsTrigger>
          <TabsTrigger value="orders" className={tabButtonClass}>
            <ReceiptText className="h-4 w-4" />
            Material Orders
          </TabsTrigger>
          {finishingSchedule && (
            <TabsTrigger value="finishing" className={tabButtonClass}>
              <Package className="h-4 w-4" />
              Finishing Schedule
            </TabsTrigger>
          )}
          <TabsTrigger value="costs" className={tabButtonClass}>
            <TrendingUp className="h-4 w-4" />
            Project Costs
          </TabsTrigger>
          <TabsTrigger value="documents" className={tabButtonClass}>
            <FileText className="h-4 w-4" />
            Site Documents
          </TabsTrigger>
          {dayRateOverrides && (
            <TabsTrigger value="day-rates" className={tabButtonClass}>
              <DollarSign className="h-4 w-4" />
              Day rate overrides
            </TabsTrigger>
          )}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-px left-0 h-0.5 rounded-full bg-primary transition-[transform,width,opacity] duration-300 ease-out"
            style={indicatorStyle}
          />
        </TabsList>
      </div>

      <TabsContent value="assignments">{assignments}</TabsContent>
      <TabsContent value="materials">{materials}</TabsContent>
      <TabsContent value="orders">{materialOrders}</TabsContent>
      {finishingSchedule && (
        <TabsContent value="finishing">{finishingSchedule}</TabsContent>
      )}
      <TabsContent value="costs">{projectCosts}</TabsContent>
      <TabsContent value="documents">{documents}</TabsContent>
      {dayRateOverrides && (
        <TabsContent value="day-rates">{dayRateOverrides}</TabsContent>
      )}

      <Dialog
        open={pendingProtectedTab !== null}
        onOpenChange={(open) => {
          if (!open && !confirmingCode) {
            setPendingProtectedTab(null);
            setConfirmationCode("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmation code required</DialogTitle>
            <DialogDescription>
              Enter the confirmation code to open{" "}
              {pendingProtectedTab === "documents"
                ? "Site Documents"
                : "Day rate overrides"}
              .
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="siteProtectedTabCode">Confirmation code</Label>
            <Input
              id="siteProtectedTabCode"
              type="password"
              value={confirmationCode}
              onChange={(event) => setConfirmationCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void handleUnlockProtectedTab();
                }
              }}
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPendingProtectedTab(null);
                setConfirmationCode("");
              }}
              disabled={confirmingCode}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleUnlockProtectedTab()}
              disabled={confirmingCode || !confirmationCode.trim()}
              className="gap-2"
            >
              {confirmingCode && <Loader2 className="h-4 w-4 animate-spin" />}
              Unlock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
