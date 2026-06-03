import React from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// @ts-nocheck - Web component text rendering is different from Expo

export interface ActiveCollaborator {
  userId: string;
  userName: string;
  userEmail: string;
  cursorPosition: number | null;
  isActive: boolean;
  lastActivityAt: number;
  color?: string;
}

interface ActiveCollaboratorsProps {
  collaborators: ActiveCollaborator[];
  currentUserId?: string;
  maxVisible?: number;
  showLabel?: boolean;
}

export function ActiveCollaborators({
  collaborators,
  currentUserId,
  maxVisible = 4,
  showLabel = true,
}: ActiveCollaboratorsProps) {
  // Filter out current user
  const otherCollaborators = collaborators.filter(
    (c) => c.userId !== currentUserId,
  );

  if (otherCollaborators.length === 0) {
    return null;
  }

  const visible = otherCollaborators.slice(0, maxVisible);
  const hidden = otherCollaborators.length - visible.length;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        {showLabel && (
          <span className="text-xs font-medium text-muted-foreground">
            <span>Editing:</span>
          </span>
        )}

        <div className="flex -space-x-2">
          {visible.map((collaborator) => (
            <Tooltip key={collaborator.userId}>
              <TooltipTrigger asChild>
                <div className="relative">
                  <Avatar className="h-8 w-8 border-2 border-background hover:border-primary transition-colors cursor-pointer">
                    <AvatarFallback
                      className={cn("text-white font-semibold text-xs")}
                      style={{
                        backgroundColor: collaborator.color || "#888888",
                      }}
                    >
                      {collaborator.userName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>

                  {/* Live indicator */}
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white animate-pulse" />
                </div>
              </TooltipTrigger>

              <TooltipContent side="bottom" className="text-xs">
                <div className="space-y-1">
                  <p className="font-semibold">{collaborator.userName}</p>
                  <p className="text-muted-foreground">
                    {collaborator.userEmail}
                  </p>
                  {collaborator.cursorPosition !== null && (
                    <p className="text-muted-foreground">
                      Position: {collaborator.cursorPosition}
                    </p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          ))}

          {hidden > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Avatar className="h-8 w-8 border-2 border-background">
                  <AvatarFallback className="bg-muted text-xs font-semibold">
                    +{hidden}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>

              <TooltipContent side="bottom" className="text-xs">
                <div className="space-y-1">
                  <p className="font-semibold">
                    {hidden} more {hidden === 1 ? "person" : "people"}
                  </p>
                  {otherCollaborators.slice(maxVisible).map((c) => (
                    <p key={c.userId} className="text-muted-foreground">
                      {c.userName}
                    </p>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <span className="text-xs text-green-600 font-medium animate-pulse">
          ●
        </span>
      </div>
    </TooltipProvider>
  );
}
