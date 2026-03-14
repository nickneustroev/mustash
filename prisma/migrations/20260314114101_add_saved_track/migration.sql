-- CreateTable
CREATE TABLE "SavedTrack" (
    "trackId" TEXT NOT NULL PRIMARY KEY,
    "trackUri" TEXT NOT NULL,
    "trackName" TEXT,
    "artistName" TEXT,
    "addedAtEpochMs" BIGINT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "SavedTrack_trackUri_key" ON "SavedTrack"("trackUri");

-- CreateIndex
CREATE INDEX "SavedTrack_trackId_idx" ON "SavedTrack"("trackId");
