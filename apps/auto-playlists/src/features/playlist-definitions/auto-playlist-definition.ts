import type { SavedTrackItem } from "../../shared/types.js";

export interface AutoPlaylistDefinition {
  key: string;
  playlistName: string;
  playlistDescription: string;
  resolveTrackUris(savedTracks: SavedTrackItem[]): string[];
  buildCoverJpeg?(): Promise<Buffer>;
}
