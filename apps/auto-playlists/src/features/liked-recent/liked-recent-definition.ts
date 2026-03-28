import type { SavedTrackItem } from "@spotify-helper/spotify";
import type { AutoPlaylistDefinition } from "../playlist-definitions/auto-playlist-definition.js";
import { generateRecentPlaylistCoverJpeg } from "./playlist-cover.js";

export interface LikedRecentDefinitionsOptions {
  windows: number[];
  playlistPrefix: string;
  playlistSuffix: string;
}

export function createLikedRecentDefinitions(
  options: LikedRecentDefinitionsOptions,
): AutoPlaylistDefinition[] {
  return options.windows.map((windowSize) => ({
    key: `liked-recent:${windowSize}`,
    playlistName: buildLikedRecentPlaylistName(
      options.playlistPrefix,
      options.playlistSuffix,
      windowSize,
    ),
    playlistDescription: `Auto-maintained recent liked tracks (${windowSize}).`,
    resolveTrackUris(savedTracks: SavedTrackItem[]): string[] {
      return savedTracks.slice(0, windowSize).map((track) => track.trackUri);
    },
    buildCoverJpeg: () => generateRecentPlaylistCoverJpeg(windowSize),
  }));
}

export function buildLikedRecentPlaylistName(prefix: string, suffix: string, windowSize: number): string {
  return `${prefix} ${windowSize} ${suffix}`.replace(/\s+/g, " ").trim();
}
