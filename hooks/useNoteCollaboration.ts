"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ActiveUser = {
  userId: string;
  userName: string;
  userEmail: string;
  cursorPosition: number | null;
  isActive: boolean;
  isTyping: boolean;
  isEditing: boolean;
  lastActivityAt: number;
  color?: string;
};

type RemoteNoteUpdate = {
  title: string;
  content: string;
  updatedAt: string;
};

type CollaborationSnapshot = {
  activeUsers: ActiveUser[];
  note: RemoteNoteUpdate;
  latestEditUserId: string | null;
};

type CollaborationOptions = {
  isTyping?: boolean;
  isEditing?: boolean;
  onRemoteNoteUpdate?: (note: RemoteNoteUpdate) => void;
};

function getUserColor(userId: string): string {
  const colors = [
    "#ef4444",
    "#f97316",
    "#eab308",
    "#22c55e",
    "#06b6d4",
    "#3b82f6",
    "#8b5cf6",
    "#ec4899",
  ];
  const hash = userId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

function withColors(users: ActiveUser[]): ActiveUser[] {
  return users.map((user) => ({
    ...user,
    color: user.color ?? getUserColor(user.userId),
  }));
}

export function useNoteCollaboration(
  noteId: string,
  userId: string,
  enabled: boolean = true,
  options: CollaborationOptions = {},
) {
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const cursorRef = useRef<{ position?: number; line?: number }>({});
  const activeUsersRef = useRef<ActiveUser[]>([]);
  const latestSeenUpdateRef = useRef<string | null>(null);
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const endpoint = `/api/notes/collaborate/${encodeURIComponent(noteId)}`;

  const applySnapshot = useCallback(
    (snapshot: CollaborationSnapshot) => {
      const users = withColors(snapshot.activeUsers);
      activeUsersRef.current = users;
      setActiveUsers(users);
      setIsConnected(true);

      const remoteUpdatedAt = snapshot.note.updatedAt;
      const isNewer = latestSeenUpdateRef.current !== remoteUpdatedAt;
      latestSeenUpdateRef.current = remoteUpdatedAt;

      if (isNewer && snapshot.latestEditUserId && snapshot.latestEditUserId !== userId) {
        optionsRef.current.onRemoteNoteUpdate?.(snapshot.note);
      }
    },
    [userId],
  );

  const fetchSnapshot = useCallback(async () => {
    if (!enabled || !noteId || !userId) return;

    const params = new URLSearchParams();
    if (cursorRef.current.position !== undefined) {
      params.set("cursorPosition", String(cursorRef.current.position));
    }
    if (cursorRef.current.line !== undefined) {
      params.set("cursorLine", String(cursorRef.current.line));
    }
    params.set("isTyping", optionsRef.current.isTyping ? "true" : "false");
    params.set("isEditing", optionsRef.current.isEditing ? "true" : "false");

    const response = await fetch(`${endpoint}?${params.toString()}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      setIsConnected(false);
      return;
    }

    applySnapshot((await response.json()) as CollaborationSnapshot);
  }, [applySnapshot, enabled, endpoint, noteId, userId]);

  useEffect(() => {
    if (!enabled || !noteId || !userId) {
      setActiveUsers([]);
      activeUsersRef.current = [];
      setIsConnected(false);
      return;
    }

    let cancelled = false;
    let timeoutId: number | null = null;

    const scheduleNextTick = () => {
      if (cancelled) return;

      const someoneIsTyping =
        optionsRef.current.isTyping ||
        optionsRef.current.isEditing ||
        activeUsersRef.current.some(
          (user) => user.userId !== userId && (user.isTyping || user.isEditing),
        );

      timeoutId = window.setTimeout(tick, someoneIsTyping ? 1500 : 10000);
    };

    const tick = async () => {
      try {
        await fetchSnapshot();
      } catch (err) {
        if (!cancelled) {
          console.warn("Failed to sync note collaboration:", err);
          setIsConnected(false);
        }
      } finally {
        scheduleNextTick();
      }
    };

    void tick();

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      void fetch(endpoint, { method: "DELETE" }).catch(() => undefined);
    };
  }, [enabled, endpoint, fetchSnapshot, noteId, userId]);

  const updateCursorPosition = useCallback((position: number, line?: number) => {
    cursorRef.current = { position, line };
  }, []);

  const broadcastEdit = useCallback(
    async (_changeType: string, _operation: string, data: Record<string, unknown>) => {
      if (!enabled || !noteId || !userId) return;

      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: typeof data.title === "string" ? data.title : undefined,
          content: typeof data.content === "string" ? data.content : undefined,
          cursorPosition: cursorRef.current.position,
          cursorLine: cursorRef.current.line,
          isTyping: true,
          isEditing: optionsRef.current.isEditing === true,
        }),
      });

      if (!response.ok) {
        setIsConnected(false);
        return;
      }

      applySnapshot((await response.json()) as CollaborationSnapshot);
    },
    [applySnapshot, enabled, endpoint, noteId, userId],
  );

  useEffect(() => {
    if (!enabled || !noteId || !userId) return;
    void fetchSnapshot();
  }, [enabled, fetchSnapshot, noteId, options.isEditing, options.isTyping, userId]);

  return {
    isConnected,
    activeUsers,
    updateCursorPosition,
    broadcastEdit,
  };
}
