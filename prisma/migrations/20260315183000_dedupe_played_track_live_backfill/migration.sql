CREATE TABLE "new_PlayedTrack" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackUri" TEXT NOT NULL,
    "trackName" TEXT,
    "artistName" TEXT,
    "playedAtEpochMs" BIGINT NOT NULL,
    "source" TEXT NOT NULL,
    "observedAtEpochMs" BIGINT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "new_PlayedTrack" (
    "id",
    "trackUri",
    "trackName",
    "artistName",
    "playedAtEpochMs",
    "source",
    "observedAtEpochMs",
    "createdAt"
)
SELECT
    "id",
    "trackUri",
    "trackName",
    "artistName",
    "playedAtEpochMs",
    "source",
    "observedAtEpochMs",
    "createdAt"
FROM (
    SELECT
        *,
        ROW_NUMBER() OVER (
            PARTITION BY "trackUri", "playedAtEpochMs"
            ORDER BY CASE WHEN "source" = 'LIVE' THEN 0 ELSE 1 END, "observedAtEpochMs" ASC, "createdAt" ASC
        ) AS "row_num"
    FROM "PlayedTrack"
)
WHERE "row_num" = 1;

DROP TABLE "PlayedTrack";
ALTER TABLE "new_PlayedTrack" RENAME TO "PlayedTrack";

CREATE UNIQUE INDEX "PlayedTrack_trackUri_playedAtEpochMs_key" ON "PlayedTrack"("trackUri", "playedAtEpochMs");
CREATE INDEX "PlayedTrack_playedAtEpochMs_idx" ON "PlayedTrack"("playedAtEpochMs" DESC);
CREATE INDEX "PlayedTrack_trackUri_playedAtEpochMs_idx" ON "PlayedTrack"("trackUri", "playedAtEpochMs");
