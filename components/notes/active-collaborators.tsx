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
  isTyping: boolean;
  isEditing: boolean;
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
  const typingCollaborators = otherCollaborators.filter((c) => c.isTyping);
  const editingCollaborators = otherCollaborators.filter((c) => c.isEditing);
  const label =
    typingCollaborators.length > 0
      ? "Typing:"
      : editingCollaborators.length > 0
        ? "Editing:"
        : "Viewing:";
  const typingNames = typingCollaborators
    .map((c) => c.userName.split(" ")[0] || c.userName)
    .join(", ");
  const editingNames = editingCollaborators
    .map((c) => c.userName.split(" ")[0] || c.userName)
    .join(", ");

  return (
    <TooltipProvider>
      <div className="flex flex-wrap items-center gap-2">
        {showLabel && (
          <span className="text-xs font-medium text-muted-foreground">
            <span>{label}</span>
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

                  <div
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white",
                      collaborator.isTyping
                        ? "animate-pulse bg-emerald-500"
                        : collaborator.isEditing
                          ? "bg-amber-500"
                        : "bg-slate-400",
                    )}
                  />
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
                  <p className="text-muted-foreground">
                    {collaborator.isTyping
                      ? "Typing now"
                      : collaborator.isEditing
                        ? "Editing"
                        : "Viewing note"}
                  </p>
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

        {typingCollaborators.length > 0 && (
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 shadow-sm">
            <span className="max-w-40 truncate">{typingNames}</span>
            <span className="flex items-end gap-0.5" aria-hidden="true">
              <span className="h-1 w-1 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.2s]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.1s]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-emerald-500" />
            </span>
          </div>
        )}

        {typingCollaborators.length === 0 && editingCollaborators.length > 0 && (
          <div className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span className="max-w-40 truncate">{editingNames} has edit open</span>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
