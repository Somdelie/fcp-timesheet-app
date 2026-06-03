# Real-Time Note Collaboration Feature

This document describes the real-time collaborative editing system for shared notes.

## Overview

The real-time collaboration feature allows multiple users to edit the same note simultaneously and see:

- **Live Presence**: See who else is currently editing the note
- **Cursor Positions**: Track where other users are typing
- **Edit History**: Full audit trail of all changes with user attribution
- **Status Indicators**: Visual indicators showing active collaborators with live update badges

## Architecture

### Components

#### 1. **Database Schema** (`prisma/schema.prisma`)

Two new models track real-time collaboration:

**NotePresence** - Tracks active users in a note:

```prisma
model NotePresence {
  noteId String
  userId String
  cursorPosition Int?      // Character position in note
  cursorLine Int?          // Line number
  isActive Boolean         // Active flag
  lastActivityAt DateTime  // Auto-updated on activity
  connectedAt DateTime     // Connection time
}
```

**NoteEditHistory** - Records all edits for audit trail:

```prisma
model NoteEditHistory {
  noteId String
  userId String
  changeType String        // "text", "title", "color", "attachment"
  operation String         // "insert", "delete", "replace", "update"
  previousContent String   // Before state
  newContent String        // After state
  startPosition Int?       // Change position
  endPosition Int?         // Change range
  createdAt DateTime       // Timestamp
}
```

#### 2. **Server-Side Service** (`lib/collaboration-service.ts`)

Manages presence tracking and edit history:

```typescript
// Update user presence in a note
CollaborationService.updatePresence(noteId, userId, cursorPosition?, cursorLine?)

// Get active collaborators
CollaborationService.getActiveCollaborators(noteId): Promise<ActiveCollaborator[]>

// Record an edit operation
CollaborationService.recordEdit(noteId, userId, changeType, operation, ...)

// Get recent edits for audit trail
CollaborationService.getRecentEdits(noteId, limit?)

// Clean up inactive presences (runs on interval)
CollaborationService.cleanupInactivePresences()
```

#### 3. **WebSocket API** (`app/api/notes/collaborate/[noteId]/route.ts`)

Real-time WebSocket endpoint for live updates:

- **Endpoint**: `ws://localhost:3000/api/notes/collaborate/[noteId]`
- **Authentication**: Requires valid session
- **Message Types**:
  - `presence`: User presence/heartbeat
  - `cursor`: Cursor position update
  - `edit`: Edit operation
  - `sync-response`: Server response with active users

#### 4. **Client-Side Hook** (`hooks/useNoteCollaboration.ts`)

React hook for managing WebSocket connections:

```typescript
const { isConnected, activeUsers, updateCursorPosition, broadcastEdit } =
  useNoteCollaboration(noteId, userId, enabled)

// Methods
updateCursorPosition(position: number, line?: number)
broadcastEdit(changeType: string, operation: string, data: Record)
```

**Features**:

- Auto-reconnect on connection loss (3s interval)
- Heartbeat to keep connection alive (30s interval)
- Automatic cleanup on unmount
- User color assignment based on ID

#### 5. **UI Component** (`components/notes/active-collaborators.tsx`)

Displays active collaborators with visual indicators:

```typescript
<ActiveCollaborators
  collaborators={activeUsers}
  currentUserId={userId}
  maxVisible={5}
  showLabel={true}
/>
```

**Features**:

- Avatar badges with user colors
- Live indicator dots (green pulse)
- Hover tooltips with cursor position
- "+N more" indicator for overflow
- Cursor position tracking

#### 6. **Integration** (`components/notes/note-detail.tsx`)

Integrated into the note detail component:

- Displays active collaborators in the note header
- Shows cursor positions and edit presence
- Updates in real-time as users type

## Usage

### For Users

1. **Open a shared note** with other collaborators
2. **See live presence** - Avatar badges appear below the note metadata
3. **Track activity** - Hover over avatars to see:
   - Collaborator name and email
   - Current cursor position
   - Last activity time
4. **Live updates** - Edits from other users appear as they type (if implemented)

### For Developers

#### Start Real-Time Collaboration

```typescript
import { useNoteCollaboration } from "@/hooks/useNoteCollaboration";

export function MyNoteEditor() {
  const { activeUsers, updateCursorPosition, broadcastEdit } =
    useNoteCollaboration(noteId, userId, canEdit);

  // Handle text changes
  const handleContentChange = (content: string) => {
    updateCursorPosition(editor.cursor);
    broadcastEdit("text", "update", {
      newContent: content,
      previousContent: oldContent
    });
  };

  // Display active users
  return (
    <>
      <ActiveCollaborators collaborators={activeUsers} />
      <Editor onChange={handleContentChange} />
    </>
  );
}
```

#### Record Edits

```typescript
import { CollaborationService } from "@/lib/collaboration-service";

// In your edit action
await CollaborationService.recordEdit(
  noteId,
  userId,
  "text", // changeType
  "update", // operation
  previousContent,
  newContent,
  startPos,
  endPos,
);
```

#### Query Edit History

```typescript
const edits = await CollaborationService.getRecentEdits(noteId, 100);

edits.forEach((edit) => {
  console.log(`${edit.userName} - ${edit.operation}: ${edit.newContent}`);
  console.log(`Changed at: ${edit.timestamp}`);
});
```

## Message Flow

### Connection Establishment

```
Client                          Server
  |--- WebSocket Connect ------->|
  |                              | (Auth check)
  |<------ sync-response --------|
  |  (active users list)         |
```

### Presence Update

```
Client                          Server
  | (User types)                |
  |--- presence message ------->|
  |  (cursor position)          | (Update DB)
  |                              |
  |<---- broadcast to others ----|
  |  (show in other clients)    |
```

### Edit Broadcasting

```
Client A                        Server                    Client B
  |                              |                          |
  |--- edit message ------------->|                          |
  |  (content + operation)       | (Record in history)      |
  |                              | (Broadcast to all)       |
  |                              |------ edit message ---->|
  |                              |    (show changes)       |
```

## Cleanup and Performance

### Automatic Cleanup

- **Inactive Presence**: Users not active for 5 minutes are automatically removed
- **Connection Pooling**: One WebSocket per user per note
- **Heartbeat**: 30-second heartbeat keeps connections alive
- **Auto-reconnect**: Automatically attempts to reconnect if connection drops

### Database Queries

```sql
-- Get active users in a note
SELECT * FROM "NotePresence"
WHERE noteId = $1
  AND isActive = true
  AND lastActivityAt > NOW() - INTERVAL '5 minutes'

-- Get recent edits
SELECT * FROM "NoteEditHistory"
WHERE noteId = $1
ORDER BY createdAt DESC
LIMIT 50

-- Cleanup inactive
DELETE FROM "NotePresence"
WHERE lastActivityAt < NOW() - INTERVAL '5 minutes'
```

## Planned Enhancements

- [ ] Operational Transformation (OT) for conflict-free editing
- [ ] Undo/Redo with multi-user support
- [ ] Comment threads on specific content
- [ ] Rich presence (typing indicators)
- [ ] Offline support with sync on reconnect
- [ ] Edit replay/playback for audit
- [ ] Merge conflict resolution UI

## Troubleshooting

### WebSocket Connection Issues

**Problem**: Connection fails or drops frequently

**Solutions**:

1. Check network connectivity
2. Verify WebSocket endpoint is accessible
3. Check browser console for errors
4. Ensure CORS headers are set correctly

### Missing Active Users

**Problem**: Other users' presence not showing

**Solutions**:

1. Verify session/authentication
2. Check database for NotePresence records
3. Look for WebSocket connection errors
4. Verify user IDs match between sessions

### Edit History Not Recording

**Problem**: NoteEditHistory table stays empty

**Solutions**:

1. Call `CollaborationService.recordEdit()` after saves
2. Verify database migrations are applied
3. Check Prisma schema includes new models
4. Ensure user ID is being passed correctly

## Security Considerations

- ✅ **Authentication**: All WebSocket connections require valid session
- ✅ **Authorization**: Users can only access notes they have permission to edit
- ✅ **Data Isolation**: Presence/history is per-note only
- ⚠️ **Rate Limiting**: Consider adding rate limits for WebSocket messages
- ⚠️ **Input Validation**: Validate cursor positions and edit content
- ⚠️ **XSS Prevention**: Sanitize content before broadcast

## Files Modified

- `prisma/schema.prisma` - Added NotePresence and NoteEditHistory models
- `lib/collaboration-service.ts` - Created server-side collaboration service
- `hooks/useNoteCollaboration.ts` - Created client-side WebSocket hook
- `components/notes/active-collaborators.tsx` - Created presence UI component
- `components/notes/note-detail.tsx` - Integrated real-time collaboration
- `app/api/notes/collaborate/[noteId]/route.ts` - WebSocket API endpoint

## Performance Notes

- Presence updates are throttled to prevent excessive database queries
- WebSocket messages are JSON-serialized (consider binary protocol for scale)
- Heartbeat interval is 30s (configurable)
- Inactive presence cleanup runs on demand (consider background job for scale)
- Database indexes on `(noteId, isActive)` and `(noteId, createdAt)` for queries

## References

- [Prisma Documentation](https://www.prisma.io/docs/)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Operational Transformation](https://en.wikipedia.org/wiki/Operational_transformation)
- [React Hooks](https://react.dev/reference/react)
