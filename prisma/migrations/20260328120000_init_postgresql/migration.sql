CREATE TYPE "PlayedTrackSource" AS ENUM ('LIVE', 'BACKFILL');

CREATE TABLE "PlayedTrack" (
    "id" TEXT NOT NULL,
    "trackUri" TEXT NOT NULL,
    "trackName" TEXT,
    "artistName" TEXT,
    "playedAt" TIMESTAMP(3) NOT NULL,
    "source" "PlayedTrackSource" NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayedTrack_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppState" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppState_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "ArchivedTrack" (
    "trackId" TEXT NOT NULL,
    "trackUri" TEXT NOT NULL,
    "trackName" TEXT,
    "artistName" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL,
    "removedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArchivedTrack_pkey" PRIMARY KEY ("trackId")
);

CREATE UNIQUE INDEX "PlayedTrack_trackUri_playedAt_key" ON "PlayedTrack"("trackUri", "playedAt");
CREATE INDEX "PlayedTrack_playedAt_idx" ON "PlayedTrack"("playedAt" DESC);
CREATE INDEX "PlayedTrack_trackUri_playedAt_idx" ON "PlayedTrack"("trackUri", "playedAt");
CREATE INDEX "ArchivedTrack_trackId_idx" ON "ArchivedTrack"("trackId");
CREATE INDEX "ArchivedTrack_removedAt_idx" ON "ArchivedTrack"("removedAt" DESC);
