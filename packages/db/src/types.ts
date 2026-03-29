import type { SavedTrackItem } from "@spotify-helper/spotify";

export type HistorySource = "live" | "backfill";

export interface HistoryEntry {
  trackUri: string;
  trackName: string | null;
  artistName: string | null;
  playedAt: Date;
  source: HistorySource;
}

export interface ArchivedTrackItem {
  trackId: string;
  trackUri: string;
  trackName: string | null;
  artistName: string | null;
  addedAt: Date;
  removedAt: Date;
}

export interface HistoryRepository {
  addLiveTrack(input: {
    trackUri: string;
    playedAt: Date;
    trackName?: string | null;
    artistName?: string | null;
  }): Promise<boolean>;
  addBackfillItems(items: Array<{
    trackUri: string;
    trackName: string | null;
    artistName: string | null;
    playedAt: Date;
  }>): Promise<number>;
  getRecentEntries(limit: number): Promise<HistoryEntry[]>;
  close(): Promise<void>;
}

export interface ArchiveRepository {
  upsertArchivedTrack(track: ArchivedTrackItem): Promise<void>;
  getArchivedTrack(trackId: string): Promise<ArchivedTrackItem | null>;
  getAllArchivedTracks(): Promise<ArchivedTrackItem[]>;
  getAllArchivedTrackIds(): Promise<string[]>;
  getArchivedTrackCount(): Promise<number>;
  close(): Promise<void>;
}

export interface AppStateRepository {
  getValue(key: string): Promise<string | null>;
  setValue(key: string, value: string): Promise<void>;
  deleteValue(key: string): Promise<void>;
  close(): Promise<void>;
}
