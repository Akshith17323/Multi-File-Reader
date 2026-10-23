BEGIN;

-- Support local and Google accounts, and all document storage locations.
-- IF NOT EXISTS also supports databases previously updated with db push.
ALTER TABLE "User"
  ALTER COLUMN "password" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "authProvider" TEXT NOT NULL DEFAULT 'LOCAL',
  ADD COLUMN IF NOT EXISTS "providerId" TEXT,
  ADD COLUMN IF NOT EXISTS "avatar" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_providerId_key" ON "User"("providerId");

ALTER TABLE "File"
  ALTER COLUMN "fileUrl" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'CLOUD',
  ADD COLUMN IF NOT EXISTS "localId" TEXT,
  ADD COLUMN IF NOT EXISTS "driveId" TEXT,
  ADD COLUMN IF NOT EXISTS "thumbnailUrl" TEXT;
UPDATE "File" SET "source" = 'LOCAL'
WHERE "fileUrl" LIKE 'mfr-local://%' AND "source" = 'CLOUD';

-- Earlier migrations identified bookmarks by fileId; the reader uses fileUrl.
ALTER TABLE "Bookmark"
  ALTER COLUMN "fileId" DROP NOT NULL,
  ALTER COLUMN "progress" TYPE DOUBLE PRECISION,
  ALTER COLUMN "progress" DROP NOT NULL,
  ALTER COLUMN "progress" DROP DEFAULT,
  ADD COLUMN IF NOT EXISTS "fileUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "fileName" TEXT,
  ADD COLUMN IF NOT EXISTS "pageNumber" INTEGER,
  ADD COLUMN IF NOT EXISTS "totalPages" INTEGER,
  ADD COLUMN IF NOT EXISTS "lastRead" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'Bookmark' AND column_name = 'total'
  ) THEN
    UPDATE "Bookmark" SET "totalPages" = NULLIF("total", 0)
    WHERE "totalPages" IS NULL;
    ALTER TABLE "Bookmark" DROP COLUMN "total";
  END IF;
END $$;

UPDATE "Bookmark" AS bookmark
SET "fileUrl" = COALESCE(bookmark."fileUrl", file."fileUrl"),
    "fileName" = COALESCE(bookmark."fileName", file."fileName")
FROM "File" AS file WHERE bookmark."fileId" = file."id";
UPDATE "Bookmark"
SET "lastRead" = COALESCE("lastRead", "updatedAt"),
    "createdAt" = COALESCE("createdAt", "updatedAt");

-- Stop and roll back for ambiguous legacy records; never discard saved progress.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Bookmark" WHERE "fileUrl" IS NULL) THEN
    RAISE EXCEPTION 'Bookmark migration needs a fileUrl for every legacy bookmark';
  END IF;
  IF EXISTS (SELECT 1 FROM "Bookmark" GROUP BY "userId", "fileUrl" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Bookmark migration needs duplicate userId/fileUrl records resolved';
  END IF;
END $$;

ALTER TABLE "Bookmark"
  ALTER COLUMN "fileUrl" SET NOT NULL,
  ALTER COLUMN "lastRead" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "lastRead" SET NOT NULL,
  ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "createdAt" SET NOT NULL,
  DROP CONSTRAINT "Bookmark_fileId_fkey",
  ADD CONSTRAINT "Bookmark_fileId_fkey" FOREIGN KEY ("fileId")
    REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;
DROP INDEX IF EXISTS "Bookmark_userId_fileId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Bookmark_userId_fileUrl_key" ON "Bookmark"("userId", "fileUrl");
CREATE INDEX IF NOT EXISTS "Bookmark_userId_idx" ON "Bookmark"("userId");

COMMIT;
