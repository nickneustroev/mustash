import type { SavedTrackItem } from "@spotify-helper/spotify";

export interface AutoPlaylistDefinition {
  key: string;
  playlistName: string;
  playlistDescription: string;
  resolveTrackUris(savedTracks: SavedTrackItem[]): string[];
  buildCoverJpeg?(): Promise<Buffer>;
}
