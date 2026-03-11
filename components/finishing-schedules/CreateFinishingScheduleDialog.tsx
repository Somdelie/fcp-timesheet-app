"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { Plus, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { createFinishingSchedule } from "@/actions/site-finishing-schedule";

type SiteOption = { id: string; name: string; code: string | null };

interface Props {
  /** If provided, locks the dialog to this specific site (used on site detail page) */
  siteId?: string;
  /** List of sites to choose from (only needed when siteId is not provided) */
  sites?: SiteOption[];
  /** Button variant */
  variant?: "default" | "outline" | "ghost";
  /** Button size */
  size?: "default" | "sm" | "lg" | "icon";
  /** Custom trigger label */
  label?: string;
}

export default function CreateFinishingScheduleDialog({
  siteId: fixedSiteId,
  sites,
  variant = "default",
  size = "default",
  label = "New Schedule",
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [selectedSiteId, setSelectedSiteId] = useState(fixedSiteId ?? "");
  const [contractNo, setContractNo] = useState("");
  const [contractManager, setContractManager] = useState("");
  const [siteForeman, setSiteForeman] = useState("");
  const [client, setClient] = useState("");
  const [startDate, setStartDate] = useState("");
  const [completionDate, setCompletionDate] = useState("");
  const [drawingDetails, setDrawingDetails] = useState("");
  const [contactInfo, setContactInfo] = useState("");

  function reset() {
    if (!fixedSiteId) setSelectedSiteId("");
    setContractNo("");
    setContractManager("");
    setSiteForeman("");
    setClient("");
    setStartDate("");
    setCompletionDate("");
    setDrawingDetails("");
    setContactInfo("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const siteId = fixedSiteId ?? selectedSiteId;
    if (!siteId) {
      toast.error("Please select a site.");
      return;
    }

    startTransition(async () => {
      const res = await createFinishingSchedule({
        siteId,
        contractNo: contractNo || null,
        contractManager: contractManager || null,
        siteForeman: siteForeman || null,
        client: client || null,
        startDate: startDate || null,
        completionDate: completionDate || null,
        drawingDetails: drawingDetails || null,
        contactInfo: contactInfo || null,
      });

      if (!res.ok) {
        toast.error(res.error ?? "Failed to create schedule.");
        return;
      }

      toast.success("Finishing schedule created.");
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          <Plus className="mr-2 h-4 w-4" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Finishing Schedule</DialogTitle>
          <DialogDescription>
            Create a new finishing schedule for a site. You can add areas and
            items after creation.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Site selector (only when not locked to a specific site) */}
          {!fixedSiteId && sites && sites.length > 0 && (
            <div className="space-y-1.5">
              <Label>Site *</Label>
              <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a site…" />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                      {s.code ? ` (${s.code})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contractNo">Contract No</Label>
              <Input
                id="contractNo"
                value={contractNo}
                onChange={(e) => setContractNo(e.target.value)}
                placeholder="e.g. FCP-2026-001"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="client">Client</Label>
              <Input
                id="client"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="e.g. Growthpoint"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contractManager">Contract Manager</Label>
              <Input
                id="contractManager"
                value={contractManager}
                onChange={(e) => setContractManager(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="siteForeman">Site Foreman</Label>
              <Input
                id="siteForeman"
                value={siteForeman}
                onChange={(e) => setSiteForeman(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="completionDate">Completion Date</Label>
              <Input
                id="completionDate"
                type="date"
                value={completionDate}
                onChange={(e) => setCompletionDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="drawingDetails">Drawing Details</Label>
            <Input
              id="drawingDetails"
              value={drawingDetails}
              onChange={(e) => setDrawingDetails(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contactInfo">Contact Info</Label>
            <Input
              id="contactInfo"
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              placeholder='e.g. "Contact At Diy Savoy: 011 440 9834"'
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Schedule
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
