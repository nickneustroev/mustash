-- CreateTable
CREATE TABLE "PlayedTrack" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackUri" TEXT NOT NULL,
    "trackName" TEXT,
    "artistName" TEXT,
    "playedAt" DATETIME NOT NULL,
    "source" TEXT NOT NULL,
    "observedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AppState" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SavedTrack" (
    "trackId" TEXT NOT NULL PRIMARY KEY,
    "trackUri" TEXT NOT NULL,
    "trackName" TEXT,
    "artistName" TEXT,
    "addedAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ArchivedTrack" (
    "trackId" TEXT NOT NULL PRIMARY KEY,
    "trackUri" TEXT NOT NULL,
    "trackName" TEXT,
    "artistName" TEXT,
    "addedAt" DATETIME NOT NULL,
    "removedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "PlayedTrack_playedAt_idx" ON "PlayedTrack"("playedAt" DESC);

-- CreateIndex
CREATE INDEX "PlayedTrack_trackUri_playedAt_idx" ON "PlayedTrack"("trackUri", "playedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlayedTrack_trackUri_playedAt_key" ON "PlayedTrack"("trackUri", "playedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SavedTrack_trackUri_key" ON "SavedTrack"("trackUri");

-- CreateIndex
CREATE INDEX "SavedTrack_trackId_idx" ON "SavedTrack"("trackId");

-- CreateIndex
CREATE INDEX "ArchivedTrack_trackId_idx" ON "ArchivedTrack"("trackId");

-- CreateIndex
CREATE INDEX "ArchivedTrack_removedAt_idx" ON "ArchivedTrack"("removedAt" DESC);
