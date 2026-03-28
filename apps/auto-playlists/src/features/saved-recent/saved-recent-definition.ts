import type { SavedTrackItem } from "@spotify-helper/spotify";
import type { AutoPlaylistDefinition } from "../playlist-definitions/auto-playlist-definition.js";
import { generateRecentPlaylistCoverJpeg } from "./playlist-cover.js";

export interface SavedRecentDefinitionsOptions {
  windows: number[];
  playlistPrefix: string;
  playlistSuffix: string;
  coverColor: string;
}

export function createSavedRecentDefinitions(
  options: SavedRecentDefinitionsOptions,
): AutoPlaylistDefinition[] {
  return options.windows.map((windowSize) => ({
    key: `saved-recent:${windowSize}`,
    playlistName: buildSavedRecentPlaylistName(
      options.playlistPrefix,
      options.playlistSuffix,
      windowSize,
    ),
    playlistDescription: `Auto-maintained recent saved tracks (${windowSize}).`,
    resolveTrackUris(savedTracks: SavedTrackItem[]): string[] {
      return savedTracks.slice(0, windowSize).map((track) => track.trackUri);
    },
    buildCoverJpeg: () => generateRecentPlaylistCoverJpeg(windowSize, options.coverColor),
  }));
}

export function buildSavedRecentPlaylistName(prefix: string, suffix: string, windowSize: number): string {
  return `${prefix} RECENT ${windowSize} ${suffix}`.replace(/\s+/g, " ").trim();
}
