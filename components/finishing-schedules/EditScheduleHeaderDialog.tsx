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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { updateFinishingSchedule } from "@/actions/site-finishing-schedule";

type ScheduleLogoKey = "FIRST_CLASS" | "UNWABU";

const LOGO_OPTIONS: Array<{ value: ScheduleLogoKey; label: string }> = [
  { value: "FIRST_CLASS", label: "FirstClass Projects" },
  { value: "UNWABU", label: "Unwabu Painting" },
];

interface Props {
  schedule: {
    id: string;
    siteAddress: string | null;
    contractNo: string | null;
    contractManager: string | null;
    siteForeman: string | null;
    fcpContractManager: string | null;
    fcpQs: string | null;
    fcpSiteForeman: string | null;
    client: string | null;
    startDate: Date | string | null;
    completionDate: Date | string | null;
    drawingDetails: string | null;
    contactInfo: string | null;
    logoKey?: ScheduleLogoKey | null;
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

  const [siteAddress, setSiteAddress] = useState(schedule.siteAddress ?? "");
  const [contractNo, setContractNo] = useState(schedule.contractNo ?? "");
  const [contractManager, setContractManager] = useState(
    schedule.contractManager ?? "",
  );
  const [siteForeman, setSiteForeman] = useState(schedule.siteForeman ?? "");
  const [fcpContractManager, setFcpContractManager] = useState(schedule.fcpContractManager ?? "");
  const [fcpQs, setFcpQs] = useState(schedule.fcpQs ?? "");
  const [fcpSiteForeman, setFcpSiteForeman] = useState(schedule.fcpSiteForeman ?? "");
  const [client, setClient] = useState(schedule.client ?? "");
  const [startDate, setStartDate] = useState(toDateStr(schedule.startDate));
  const [completionDate, setCompletionDate] = useState(
    toDateStr(schedule.completionDate),
  );
  const [drawingDetails, setDrawingDetails] = useState(
    schedule.drawingDetails ?? "",
  );
  const [contactInfo, setContactInfo] = useState(schedule.contactInfo ?? "");
  const [logoKey, setLogoKey] = useState<ScheduleLogoKey>(
    schedule.logoKey ?? "FIRST_CLASS",
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateFinishingSchedule({
        id: schedule.id,
        siteAddress: siteAddress || null,
        contractNo: contractNo || null,
        contractManager: contractManager || null,
        siteForeman: siteForeman || null,
        fcpContractManager: fcpContractManager || null,
        fcpQs: fcpQs || null,
        fcpSiteForeman: fcpSiteForeman || null,
        client: client || null,
        startDate: startDate || null,
        completionDate: completionDate || null,
        drawingDetails: drawingDetails || null,
        contactInfo: contactInfo || null,
        logoKey,
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
          <div className="space-y-1.5">
            <Label htmlFor="eh-siteAddress">Site Address</Label>
            <Input
              id="eh-siteAddress"
              value={siteAddress}
              onChange={(e) => setSiteAddress(e.target.value)}
              placeholder="Enter site address"
            />
          </div>
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
              <Label htmlFor="eh-fcpContractManager">FCP Contract Manager</Label>
              <Input
                id="eh-fcpContractManager"
                value={fcpContractManager}
                onChange={(e) => setFcpContractManager(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eh-fcpQs">FCP QS</Label>
              <Input
                id="eh-fcpQs"
                value={fcpQs}
                onChange={(e) => setFcpQs(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="eh-fcpSiteForeman">FCP Site Foreman</Label>
              <Input
                id="eh-fcpSiteForeman"
                value={fcpSiteForeman}
                onChange={(e) => setFcpSiteForeman(e.target.value)}
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
          <div className="space-y-1.5">
            <Label>PDF Logo</Label>
            <Select
              value={logoKey}
              onValueChange={(value) => setLogoKey(value as ScheduleLogoKey)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select PDF logo" />
              </SelectTrigger>
              <SelectContent>
                {LOGO_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
