-- CreateTable
CREATE TABLE "PlayEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackUri" TEXT NOT NULL,
    "playedAtEpochMs" BIGINT NOT NULL,
    "source" TEXT NOT NULL,
    "observedAtEpochMs" BIGINT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AppState" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "PlayEvent_playedAtEpochMs_idx" ON "PlayEvent"("playedAtEpochMs" DESC);

-- CreateIndex
CREATE INDEX "PlayEvent_trackUri_playedAtEpochMs_idx" ON "PlayEvent"("trackUri", "playedAtEpochMs");

-- CreateIndex
CREATE UNIQUE INDEX "PlayEvent_trackUri_playedAtEpochMs_source_key" ON "PlayEvent"("trackUri", "playedAtEpochMs", "source");
