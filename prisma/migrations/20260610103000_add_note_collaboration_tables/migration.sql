CREATE TABLE IF NOT EXISTS "NotePresence" (
  "id" TEXT NOT NULL,
  "noteId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "cursorPosition" INTEGER,
  "cursorLine" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NotePresence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NotePresence_noteId_userId_key"
  ON "NotePresence"("noteId", "userId");

CREATE INDEX IF NOT EXISTS "NotePresence_noteId_isActive_idx"
  ON "NotePresence"("noteId", "isActive");

CREATE INDEX IF NOT EXISTS "NotePresence_userId_idx"
  ON "NotePresence"("userId");

CREATE INDEX IF NOT EXISTS "NotePresence_lastActivityAt_idx"
  ON "NotePresence"("lastActivityAt");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'UserNote'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'User'
  ) THEN

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'NotePresence_noteId_fkey'
    ) THEN
      ALTER TABLE "NotePresence"
        ADD CONSTRAINT "NotePresence_noteId_fkey"
        FOREIGN KEY ("noteId") REFERENCES "UserNote"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'NotePresence_userId_fkey'
    ) THEN
      ALTER TABLE "NotePresence"
        ADD CONSTRAINT "NotePresence_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "NoteEditHistory" (
  "id" TEXT NOT NULL,
  "noteId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "previousContent" TEXT NOT NULL,
  "newContent" TEXT NOT NULL,
  "changeType" TEXT NOT NULL DEFAULT 'text',
  "operation" TEXT NOT NULL DEFAULT 'update',
  "startPosition" INTEGER,
  "endPosition" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NoteEditHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NoteEditHistory_noteId_createdAt_idx"
  ON "NoteEditHistory"("noteId", "createdAt");

CREATE INDEX IF NOT EXISTS "NoteEditHistory_userId_idx"
  ON "NoteEditHistory"("userId");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'UserNote'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'User'
  ) THEN

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'NoteEditHistory_noteId_fkey'
    ) THEN
      ALTER TABLE "NoteEditHistory"
        ADD CONSTRAINT "NoteEditHistory_noteId_fkey"
        FOREIGN KEY ("noteId") REFERENCES "UserNote"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'NoteEditHistory_userId_fkey'
    ) THEN
      ALTER TABLE "NoteEditHistory"
        ADD CONSTRAINT "NoteEditHistory_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

  END IF;
END $$;