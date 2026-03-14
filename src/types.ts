export type ItemType = "track" | "episode" | "ad" | "unknown";

export interface PlaybackSnapshot {
  isPlaying: boolean;
  itemType: ItemType;
  trackId: string | null;
  trackUri: string | null;
  trackName: string | null;
  artists: string[];
  progressMs: number | null;
  fetchedAtEpochMs: number;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAtEpochMs: number;
}

export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export type HistorySource = "live" | "backfill";

export interface HistoryEntry {
  trackUri: string;
  trackName: string | null;
  artistName: string | null;
  playedAtEpochMs: number;
  source: HistorySource;
}

export interface RecentlyPlayedItem {
  trackUri: string;
  trackName: string | null;
  artistName: string | null;
  playedAtEpochMs: number;
}

export interface SavedTrackItem {
  trackId: string;
  trackUri: string;
  trackName: string | null;
  artistName: string | null;
  addedAtEpochMs: number;
}
