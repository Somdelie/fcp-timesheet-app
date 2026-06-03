import { NextRequest, NextResponse } from "next/server";
import { requireServerAuth } from "@/lib/auth-server";
import { CollaborationService } from "@/lib/collaboration-service";

type NoteSocket = {
  send: (data: string) => void;
  onmessage?: (event: MessageEvent) => void;
  onerror?: (error: Event) => void;
  onclose?: () => void;
  readyState?: number;
};

const SOCKET_OPEN = 1;

// Map to store active WebSocket connections per note
const activeConnections = new Map<string, Set<NoteSocket>>();

/**
 * WebSocket upgrade handler for real-time note collaboration
 * Handles user presence, cursor position, and edit broadcasting
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> },
) {
  try {
    const { noteId } = await params;

    // Verify user is authenticated
    const auth = await requireServerAuth();
    const userId = auth.userId;

    const userInfo = await CollaborationService.getUserInfo(userId);
    if (!userInfo) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Check if browser supports WebSocket
    if (request.headers.get("upgrade") !== "websocket") {
      return new NextResponse("Upgrade header missing", { status: 400 });
    }

    // Create WebSocket connection
    const { socket, response } = await upgradeConnection(request);

    // Track this connection
    if (!activeConnections.has(noteId)) {
      activeConnections.set(noteId, new Set());
    }
    const connections = activeConnections.get(noteId)!;
    connections.add(socket);

    // Record user presence
    await CollaborationService.updatePresence(noteId, userId);

    // Send sync response with active users
    const activeUsers =
      await CollaborationService.getActiveCollaborators(noteId);
    socket.send(
      JSON.stringify({
        type: "sync-response",
        data: {
          users: activeUsers,
        },
      }),
    );

    // Handle messages from this user
    socket.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case "presence":
            // Update presence when user sends heartbeat
            const cursorPosition = message.data?.cursorPosition as
              | number
              | undefined;
            const cursorLine = message.data?.cursorLine as number | undefined;

            await CollaborationService.updatePresence(
              noteId,
              userId,
              cursorPosition,
              cursorLine,
            );

            // Broadcast presence to all other users
            broadcastToOthers(noteId, socket, {
              type: "presence",
              userId,
              userName: userInfo.name,
              userEmail: userInfo.email,
              data: {
                cursorPosition,
                cursorLine,
              },
              timestamp: Date.now(),
            });
            break;

          case "cursor":
            // Update cursor position
            const position = message.data?.position as number | undefined;
            const line = message.data?.line as number | undefined;

            await CollaborationService.updatePresence(
              noteId,
              userId,
              position,
              line,
            );

            // Broadcast cursor update
            broadcastToOthers(noteId, socket, {
              type: "cursor",
              userId,
              data: {
                position,
                line,
              },
              timestamp: Date.now(),
            });
            break;

          case "edit":
            // Record edit operation
            const { changeType, operation } = message.data as {
              changeType: "text" | "title" | "color" | "attachment";
              operation: "insert" | "delete" | "replace" | "update";
            };
            const { previousContent, newContent } = message.data as {
              previousContent: string;
              newContent: string;
            };
            const { startPosition, endPosition } = message.data as {
              startPosition?: number;
              endPosition?: number;
            };

            await CollaborationService.recordEdit(
              noteId,
              userId,
              changeType,
              operation,
              previousContent,
              newContent,
              startPosition,
              endPosition,
            );

            // Broadcast edit to all users
            broadcastToAll(noteId, {
              type: "edit",
              userId,
              userName: userInfo.name,
              userEmail: userInfo.email,
              data: message.data,
              timestamp: Date.now(),
            });
            break;

          default:
            console.log("Unknown message type:", message.type);
        }
      } catch (error) {
        console.error("Error handling collaboration message:", error);
      }
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    socket.onclose = async () => {
      // Remove this connection
      connections.delete(socket);

      // Clean up if no more connections for this note
      if (connections.size === 0) {
        activeConnections.delete(noteId);
      }

      // Remove user presence if no other connections
      const userConnections = Array.from(activeConnections.values()).some(
        (conns) => {
          // Check if user has other connections in other notes
          // For now, just remove presence after 30 seconds of inactivity
        },
      );

      if (!userConnections) {
        await CollaborationService.removePresence(noteId, userId);
      }

      console.log(
        `User ${userId} disconnected from note ${noteId}. Active connections: ${connections.size}`,
      );
    };

    return response;
  } catch (error) {
    console.error("WebSocket upgrade error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

/**
 * Upgrade HTTP connection to WebSocket
 * This is a simplified implementation; real production code should use a proper WebSocket library
 */
async function upgradeConnection(request: NextRequest) {
  // Note: This is a simplified stub. In production, you should use:
  // - A proper WebSocket library like `ws`
  // - Or use a WebSocket service like Socket.IO
  // - Or upgrade to Node.js runtime with WebSocket support

  // For now, return a placeholder response
  const response = new NextResponse(null, {
    status: 101,
    statusText: "Switching Protocols",
  });

  response.headers.set("Upgrade", "websocket");
  response.headers.set("Connection", "Upgrade");

  // Return placeholder WebSocket object (this would be replaced with real implementation)
  const socket = {
    send: (data: string) => {
      /* placeholder */
    },
    onmessage: (event: MessageEvent) => {
      /* placeholder */
    },
    onerror: (error: Event) => {
      /* placeholder */
    },
    onclose: () => {
      /* placeholder */
    },
  };

  return { socket, response };
}

/**
 * Broadcast message to all connections except sender
 */
function broadcastToOthers(
  noteId: string,
  excludeSocket: NoteSocket,
  message: Record<string, unknown>,
) {
  const connections = activeConnections.get(noteId);
  if (!connections) return;

  const data = JSON.stringify(message);
  connections.forEach((socket) => {
    if (socket !== excludeSocket && socket.readyState === SOCKET_OPEN) {
      socket.send(data);
    }
  });
}

/**
 * Broadcast message to all connections
 */
function broadcastToAll(noteId: string, message: Record<string, unknown>) {
  const connections = activeConnections.get(noteId);
  if (!connections) return;

  const data = JSON.stringify(message);
  connections.forEach((socket) => {
    if (socket.readyState === SOCKET_OPEN) {
      socket.send(data);
    }
  });
}
