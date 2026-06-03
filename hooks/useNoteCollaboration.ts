import { useEffect, useRef, useState, useCallback } from "react";

export interface CollaborationMessage {
  type: "presence" | "edit" | "cursor" | "sync" | "sync-response";
  userId?: string;
  userName?: string;
  userEmail?: string;
  data?: Record<string, unknown>;
  timestamp?: number;
}

export interface ActiveUser {
  userId: string;
  userName: string;
  userEmail: string;
  cursorPosition: number | null;
  isActive: boolean;
  lastActivityAt: number;
  color?: string;
}

const CURSOR_COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#FFA07A",
  "#98D8C8",
  "#F7DC6F",
  "#BB8FCE",
  "#85C1E2",
];

/**
 * Hook to manage real-time collaboration for a note
 */
export function useNoteCollaboration(
  noteId: string,
  userId: string,
  enabled: boolean = true,
) {
  const wsRef = useRef<WebSocket | null>(null);
  const [activeUsers, setActiveUsers] = useState<Map<string, ActiveUser>>(
    new Map(),
  );
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!enabled || !noteId || !userId) return;

    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/api/notes/collaborate/${noteId}`;

      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log("Collaboration service connected");
        setIsConnected(true);

        // Send initial presence
        wsRef.current?.send(
          JSON.stringify({
            type: "presence",
            userId,
            timestamp: Date.now(),
          }),
        );

        // Start heartbeat
        startHeartbeat();
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: CollaborationMessage = JSON.parse(event.data);
          handleMessage(message);
        } catch (err) {
          console.error("Failed to parse collaboration message:", err);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error("Collaboration WebSocket error:", error);
        setIsConnected(false);
      };

      wsRef.current.onclose = () => {
        console.log("Collaboration service disconnected");
        setIsConnected(false);

        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };
    } catch (err) {
      console.error("Failed to connect collaboration service:", err);
    }
  }, [enabled, noteId, userId]);

  // Handle incoming messages
  const handleMessage = (message: CollaborationMessage) => {
    switch (message.type) {
      case "presence":
        if (message.userId && message.data) {
          const userColor =
            CURSOR_COLORS[parseInt(message.userId, 36) % CURSOR_COLORS.length];

          setActiveUsers((prev) => {
            const updated = new Map(prev);
            updated.set(message.userId!, {
              userId: message.userId!,
              userName: message.userName || "Unknown",
              userEmail: message.userEmail || "",
              cursorPosition: (message.data?.cursorPosition as number) || null,
              isActive: true,
              lastActivityAt: message.timestamp || Date.now(),
              color: userColor,
            });
            return updated;
          });
        }
        break;

      case "cursor":
        if (message.userId) {
          setActiveUsers((prev) => {
            const updated = new Map(prev);
            const user = updated.get(message.userId!);
            if (user) {
              updated.set(message.userId!, {
                ...user,
                cursorPosition: (message.data?.position as number) || null,
              });
            }
            return updated;
          });
        }
        break;

      case "sync-response":
        // Server sends back active users list
        if (message.data?.users) {
          const users = message.data.users as ActiveUser[];
          const userMap = new Map<string, ActiveUser>();
          users.forEach((u) => {
            const userColor =
              CURSOR_COLORS[parseInt(u.userId, 36) % CURSOR_COLORS.length];
            userMap.set(u.userId, { ...u, color: userColor });
          });
          setActiveUsers(userMap);
        }
        break;
    }
  };

  // Send heartbeat to keep connection alive
  const startHeartbeat = () => {
    heartbeatTimeoutRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "presence",
            userId,
            timestamp: Date.now(),
          }),
        );
      }
    }, 30000); // Every 30 seconds
  };

  // Update cursor position
  const updateCursorPosition = useCallback(
    (position: number, line?: number) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "cursor",
            userId,
            data: { position, line },
            timestamp: Date.now(),
          }),
        );
      }
    },
    [userId],
  );

  // Broadcast an edit
  const broadcastEdit = useCallback(
    (changeType: string, operation: string, data: Record<string, unknown>) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "edit",
            userId,
            data: { changeType, operation, ...data },
            timestamp: Date.now(),
          }),
        );
      }
    },
    [userId],
  );

  // Disconnect and cleanup
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (heartbeatTimeoutRef.current) {
      clearInterval(heartbeatTimeoutRef.current);
    }

    setIsConnected(false);
    setActiveUsers(new Map());
  }, []);

  // Connect on mount
  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    isConnected,
    activeUsers: Array.from(activeUsers.values()),
    updateCursorPosition,
    broadcastEdit,
  };
}
