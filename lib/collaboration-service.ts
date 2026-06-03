import { prisma } from "@/lib/prisma";

export interface ActiveCollaborator {
  userId: string;
  userName: string;
  userEmail: string;
  cursorPosition: number | null;
  isActive: boolean;
  lastActivityAt: Date;
}

export interface EditOperation {
  type: "text" | "title" | "color" | "attachment";
  operation: "insert" | "delete" | "replace" | "update";
  userId: string;
  userName: string;
  userEmail: string;
  previousContent: string;
  newContent: string;
  startPosition?: number;
  endPosition?: number;
  timestamp: Date;
}

/**
 * Manages real-time collaboration for notes
 */
export class CollaborationService {
  /**
   * Record user presence in a note
   */
  static async updatePresence(
    noteId: string,
    userId: string,
    cursorPosition?: number,
    cursorLine?: number,
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Upsert presence record
    await prisma.notePresence.upsert({
      where: {
        noteId_userId: { noteId, userId },
      },
      create: {
        noteId,
        userId,
        cursorPosition: cursorPosition ?? null,
        cursorLine: cursorLine ?? null,
        isActive: true,
      },
      update: {
        cursorPosition: cursorPosition ?? null,
        cursorLine: cursorLine ?? null,
        isActive: true,
        lastActivityAt: new Date(),
      },
    });
  }

  /**
   * Remove user presence from note
   */
  static async removePresence(noteId: string, userId: string): Promise<void> {
    await prisma.notePresence.deleteMany({
      where: { noteId, userId },
    });
  }

  /**
   * Get active collaborators in a note
   */
  static async getActiveCollaborators(
    noteId: string,
  ): Promise<ActiveCollaborator[]> {
    const presences = await prisma.notePresence.findMany({
      where: {
        noteId,
        isActive: true,
        // Remove inactive users after 5 minutes
        lastActivityAt: {
          gt: new Date(Date.now() - 5 * 60 * 1000),
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return presences.map((p) => ({
      userId: p.userId,
      userName: p.user.name ?? "Unknown",
      userEmail: p.user.email,
      cursorPosition: p.cursorPosition,
      isActive: p.isActive,
      lastActivityAt: p.lastActivityAt,
    }));
  }

  /**
   * Record an edit operation
   */
  static async recordEdit(
    noteId: string,
    userId: string,
    changeType: "text" | "title" | "color" | "attachment",
    operation: "insert" | "delete" | "replace" | "update",
    previousContent: string,
    newContent: string,
    startPosition?: number,
    endPosition?: number,
  ): Promise<void> {
    await prisma.noteEditHistory.create({
      data: {
        noteId,
        userId,
        changeType,
        operation,
        previousContent,
        newContent,
        startPosition,
        endPosition,
      },
    });
  }

  /**
   * Get recent edits for a note
   */
  static async getRecentEdits(
    noteId: string,
    limit: number = 50,
  ): Promise<EditOperation[]> {
    const edits = await prisma.noteEditHistory.findMany({
      where: { noteId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return edits.map((e) => ({
      type: e.changeType as "text" | "title" | "color" | "attachment",
      operation: e.operation as "insert" | "delete" | "replace" | "update",
      userId: e.userId,
      userName: e.user.name ?? "Unknown",
      userEmail: e.user.email,
      previousContent: e.previousContent,
      newContent: e.newContent,
      startPosition: e.startPosition ?? undefined,
      endPosition: e.endPosition ?? undefined,
      timestamp: e.createdAt,
    }));
  }

  /**
   * Clean up inactive presences
   */
  static async cleanupInactivePresences(): Promise<void> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    await prisma.notePresence.deleteMany({
      where: {
        lastActivityAt: {
          lt: fiveMinutesAgo,
        },
      },
    });
  }

  /**
   * Get user by ID with safe info
   */
  static async getUserInfo(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    return user;
  }
}
