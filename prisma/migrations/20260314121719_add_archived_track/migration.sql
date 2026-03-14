-- CreateTable
CREATE TABLE "ArchivedTrack" (
    "trackId" TEXT NOT NULL PRIMARY KEY,
    "trackUri" TEXT NOT NULL,
    "trackName" TEXT,
    "artistName" TEXT,
    "addedAtEpochMs" BIGINT NOT NULL,
    "removedAtEpochMs" BIGINT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "ArchivedTrack_trackId_idx" ON "ArchivedTrack"("trackId");

-- CreateIndex
CREATE INDEX "ArchivedTrack_removedAtEpochMs_idx" ON "ArchivedTrack"("removedAtEpochMs" DESC);
