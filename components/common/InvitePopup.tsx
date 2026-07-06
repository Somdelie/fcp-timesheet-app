"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Invite = {
  id: string;
  noteId: string;
  invitedBy: { id?: string; name?: string };
  noteTitle?: string | null;
  createdAt: string;
};

const SHOWN_KEY = "shown-invite-ids";

export default function InvitePopup() {
  const [invite, setInvite] = useState<Invite | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadInvites() {
      try {
        const raw = localStorage.getItem(SHOWN_KEY);
        const shownIds = raw ? (JSON.parse(raw) as string[]) : [];
        const shownSet = new Set(shownIds);

        const res = await fetch("/api/app/notes/invites", {
          method: "GET",
          cache: "no-store",
        });

        if (!res.ok) return;

        const data = (await res.json()) as Invite[];

        if (cancelled || !Array.isArray(data)) return;

        const firstUnseen = data.find((i) => !shownSet.has(i.id));

        if (firstUnseen) {
          setInvite(firstUnseen);
        }
      } catch {
        // ignore
      }
    }

    loadInvites();

    return () => {
      cancelled = true;
    };
  }, []);

  const markShown = (id: string) => {
    try {
      const raw = localStorage.getItem(SHOWN_KEY);
      const arr = raw ? (JSON.parse(raw) as string[]) : [];

      if (!arr.includes(id)) {
        arr.push(id);
      }

      localStorage.setItem(SHOWN_KEY, JSON.stringify(arr));
    } catch {
      // ignore
    }
  };

  const handleAccept = async () => {
    if (!invite) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/app/notes/invites/${invite.id}`, {
        method: "PATCH",
      });

      if (!res.ok) throw new Error("Failed to accept");

      markShown(invite.id);
      setInvite(null);
    } catch (err: any) {
      setError(err?.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async () => {
    if (!invite) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/app/notes/invites/${invite.id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to decline");

      markShown(invite.id);
      setInvite(null);
    } catch (err: any) {
      setError(err?.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  };

  if (!invite) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 rounded-lg border bg-popover p-4 shadow-lg">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <strong className="text-sm">Note collaboration invite</strong>
            <Badge variant="outline" className="text-[11px]">
              Invite
            </Badge>
          </div>

          <div className="mt-1 text-sm text-muted-foreground">
            <div>
              <strong>{invite.invitedBy?.name ?? "Someone"}</strong> invited you
              to collaborate on
            </div>

            <div className="mt-1 font-medium">
              {invite.noteTitle ?? "a note"}
            </div>
          </div>

          {error && (
            <div className="mt-2 text-xs text-destructive">{error}</div>
          )}

          <div className="mt-3 flex gap-2">
            <Button onClick={handleAccept} disabled={loading}>
              Accept
            </Button>

            <Button variant="ghost" onClick={handleDecline} disabled={loading}>
              Decline
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
