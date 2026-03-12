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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { addFinishingArea } from "@/actions/site-finishing-schedule";

interface Props {
  scheduleId: string;
}

export default function CreateAreaDialog({ scheduleId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [label, setLabel] = useState("");

  function reset() {
    setName("");
    setLabel("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Area name is required.");
      return;
    }
    startTransition(async () => {
      const res = await addFinishingArea({
        scheduleId,
        name: name.trim(),
        label: label.trim() || null,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Failed to create area.");
        return;
      }
      toast.success("Area created.");
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
        <Button variant="default" size="sm">
          <Plus className="mr-2 h-3.5 w-3.5" />
          Add Area
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Area</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ca-name">Area Code / Name *</Label>
            <Input
              id="ca-name"
              placeholder='e.g. "AA", "CB"'
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ca-label">Label / Description</Label>
            <Input
              id="ca-label"
              placeholder='e.g. "Offices", "Substation"'
              value={label}
              onChange={(e) => setLabel(e.target.value)}
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
              Add Area
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
