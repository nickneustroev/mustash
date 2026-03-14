-- Rename PlayEvent to PlayedTrack
ALTER TABLE "PlayEvent" RENAME TO "PlayedTrack";

-- Rename PlayEventSource to PlayedTrackSource (enum doesn't exist in SQLite, so we keep it as-is in column)