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
  siteId?: string;
  sites?: SiteOption[];
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
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

  // ✅ NEW
  const [fcpContractManager, setFcpContractManager] = useState("");
  const [fcpSiteForeman, setFcpSiteForeman] = useState("");

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

    setFcpContractManager("");
    setFcpSiteForeman("");

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

        // ✅ NEW
        fcpContractManager: fcpContractManager || null,
        fcpSiteForeman: fcpSiteForeman || null,

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

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Finishing Schedule</DialogTitle>
          <DialogDescription>
            Create a new finishing schedule for a site.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!fixedSiteId && sites?.length ? (
            <div>
              <Label>Site *</Label>
              <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select site..." />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} {s.code ? `(${s.code})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {/* Contract + Client */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Contract No</Label>
              <Input
                value={contractNo}
                onChange={(e) => setContractNo(e.target.value)}
              />
            </div>

            <div>
              <Label>Client</Label>
              <Input
                value={client}
                onChange={(e) => setClient(e.target.value)}
              />
            </div>
          </div>

          {/* CLIENT SIDE */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Contract Manager</Label>
              <Input
                value={contractManager}
                onChange={(e) => setContractManager(e.target.value)}
              />
            </div>

            <div>
              <Label>Site Foreman</Label>
              <Input
                value={siteForeman}
                onChange={(e) => setSiteForeman(e.target.value)}
              />
            </div>
          </div>

          {/* ✅ FCP SIDE */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>FCP Contract Manager</Label>
              <Input
                value={fcpContractManager}
                onChange={(e) => setFcpContractManager(e.target.value)}
              />
            </div>

            <div>
              <Label>FCP Site Foreman</Label>
              <Input
                value={fcpSiteForeman}
                onChange={(e) => setFcpSiteForeman(e.target.value)}
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              type="date"
              value={completionDate}
              onChange={(e) => setCompletionDate(e.target.value)}
            />
          </div>

          <Input
            placeholder="Drawing details"
            value={drawingDetails}
            onChange={(e) => setDrawingDetails(e.target.value)}
          />

          <Input
            placeholder="Contact info"
            value={contactInfo}
            onChange={(e) => setContactInfo(e.target.value)}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>

            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
