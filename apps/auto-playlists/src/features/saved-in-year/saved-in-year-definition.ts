import type { SavedTrackItem } from "@spotify-helper/spotify";
import type { AutoPlaylistDefinition } from "../playlist-definitions/auto-playlist-definition.js";

export interface SavedInYearDefinitionsOptions {
  years: number[];
  playlistPrefix: string;
  playlistSuffix: string;
}

export function createSavedInYearDefinitions(
  options: SavedInYearDefinitionsOptions,
): AutoPlaylistDefinition[] {
  return options.years.map((year) => ({
    key: `saved-in-year:${year}`,
    playlistName: buildSavedInYearPlaylistName(options.playlistPrefix, options.playlistSuffix, year),
    playlistDescription: `Auto-maintained saved tracks from ${year}.`,
    resolveTrackUris(savedTracks: SavedTrackItem[]): string[] {
      return savedTracks
        .filter((track) => track.addedAt.getUTCFullYear() === year)
        .map((track) => track.trackUri);
    },
  }));
}

export function buildSavedInYearPlaylistName(prefix: string, suffix: string, year: number): string {
  return `${prefix} ${year} ${suffix}`.replace(/\s+/g, " ").trim();
}
