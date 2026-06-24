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

export default function InvitePopup() {
  const [invite, setInvite] = useState<Invite | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const SHOWN_KEY = "shown-invite-ids";

  useEffect(() => {
    if (typeof window === "undefined") return;

    const shownRaw = localStorage.getItem(SHOWN_KEY);
    const shownSet = shownRaw
      ? new Set(JSON.parse(shownRaw) as string[])
      : new Set<string>();

    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/app/notes/invites/stream");
    } catch (err) {
      // fallback: do nothing
    }

    const onMessage = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data) as Invite[];
        if (!Array.isArray(data) || data.length === 0) return;
        const firstUnseen = data.find((i) => !shownSet.has(i.id));
        if (firstUnseen) setInvite(firstUnseen);
      } catch (err) {
        // ignore parse errors
      }
    };

    if (es) {
      es.addEventListener("message", onMessage as any);
      es.addEventListener("error", () => {
        // reconnects automatically; ignore errors
      });
    }

    return () => {
      if (es) {
        es.removeEventListener("message", onMessage as any);
        es.close();
      }
    };
  }, []);

  const markShown = (id: string) => {
    try {
      const raw = localStorage.getItem(SHOWN_KEY);
      const arr = raw ? (JSON.parse(raw) as string[]) : [];
      if (!arr.includes(id)) arr.push(id);
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
