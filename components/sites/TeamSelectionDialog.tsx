"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export const TEAMS = ["PAINTERS", "BUILDING", "SPECIAL_COATINGS", "CAPE_TOWN"];

interface SupervisorTeamEntry {
  supervisorId: string;
  supervisorName: string;
  team: string | null;
}

interface TeamSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supervisors: SupervisorTeamEntry[];
  onConfirm: (
    teamAssignments: { supervisorId: string; team: string }[],
  ) => void;
  isLoading?: boolean;
}

export function TeamSelectionDialog({
  open,
  onOpenChange,
  supervisors,
  onConfirm,
  isLoading = false,
}: TeamSelectionDialogProps) {
  const [teams, setTeams] = React.useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    supervisors.forEach((sup) => {
      initial[sup.supervisorId] = sup.team || "";
    });
    return initial;
  });

  const allTeamsAssigned = supervisors.every((sup) => teams[sup.supervisorId]);

  const handleConfirm = () => {
    const assignments = supervisors
      .map((sup) => ({
        supervisorId: sup.supervisorId,
        team: teams[sup.supervisorId],
      }))
      .filter((a) => a.team);
    onConfirm(assignments);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Select Teams for Supervisors</DialogTitle>
          <DialogDescription>
            Since you have multiple supervisors at this site, assign each to a
            team. Foremen will be routed based on their team assignment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {supervisors.map((supervisor) => (
            <div key={supervisor.supervisorId} className="space-y-2">
              <label className="text-sm font-medium text-slate-900 dark:text-white">
                {supervisor.supervisorName}
              </label>
              <Select
                value={teams[supervisor.supervisorId] || ""}
                onValueChange={(value) =>
                  setTeams((prev) => ({
                    ...prev,
                    [supervisor.supervisorId]: value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a team" />
                </SelectTrigger>
                <SelectContent>
                  {TEAMS.map((team) => (
                    <SelectItem key={team} value={team}>
                      {team}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!allTeamsAssigned || isLoading}
          >
            {isLoading ? "Assigning..." : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
