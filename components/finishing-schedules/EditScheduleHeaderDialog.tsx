"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { Pencil, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { updateFinishingSchedule } from "@/actions/site-finishing-schedule";

interface Props {
  schedule: {
    id: string;
    contractNo: string | null;
    contractManager: string | null;
    siteForeman: string | null;
    client: string | null;
    startDate: Date | string | null;
    completionDate: Date | string | null;
    drawingDetails: string | null;
    contactInfo: string | null;
  };
}

function toDateStr(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export default function EditScheduleHeaderDialog({ schedule }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [contractNo, setContractNo] = useState(schedule.contractNo ?? "");
  const [contractManager, setContractManager] = useState(
    schedule.contractManager ?? "",
  );
  const [siteForeman, setSiteForeman] = useState(schedule.siteForeman ?? "");
  const [client, setClient] = useState(schedule.client ?? "");
  const [startDate, setStartDate] = useState(toDateStr(schedule.startDate));
  const [completionDate, setCompletionDate] = useState(
    toDateStr(schedule.completionDate),
  );
  const [drawingDetails, setDrawingDetails] = useState(
    schedule.drawingDetails ?? "",
  );
  const [contactInfo, setContactInfo] = useState(schedule.contactInfo ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateFinishingSchedule({
        id: schedule.id,
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
        toast.error(res.error ?? "Failed to update.");
        return;
      }
      toast.success("Schedule header updated.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="mr-2 h-3.5 w-3.5" />
          Edit Header
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Schedule Header</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="eh-contractNo">Contract No</Label>
              <Input
                id="eh-contractNo"
                value={contractNo}
                onChange={(e) => setContractNo(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eh-client">Client</Label>
              <Input
                id="eh-client"
                value={client}
                onChange={(e) => setClient(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="eh-contractManager">Contract Manager</Label>
              <Input
                id="eh-contractManager"
                value={contractManager}
                onChange={(e) => setContractManager(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eh-siteForeman">Site Foreman</Label>
              <Input
                id="eh-siteForeman"
                value={siteForeman}
                onChange={(e) => setSiteForeman(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="eh-startDate">Start Date</Label>
              <Input
                id="eh-startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eh-completionDate">Completion Date</Label>
              <Input
                id="eh-completionDate"
                type="date"
                value={completionDate}
                onChange={(e) => setCompletionDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eh-drawingDetails">Drawing Details</Label>
            <Input
              id="eh-drawingDetails"
              value={drawingDetails}
              onChange={(e) => setDrawingDetails(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eh-contactInfo">Contact Info</Label>
            <Input
              id="eh-contactInfo"
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
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
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
