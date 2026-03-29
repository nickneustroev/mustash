import type { SavedTrackItem } from "../../shared/types.js";
import type { AutoPlaylistDefinition } from "../playlist-definitions/auto-playlist-definition.js";
import { generateSavedInYearPlaylistCoverJpeg } from "./playlist-cover.js";

export interface SavedInYearDefinitionsOptions {
  years: number[];
  playlistPrefix: string;
  playlistSuffix: string;
  coverColor: string;
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
    buildCoverJpeg: () => generateSavedInYearPlaylistCoverJpeg(year, options.coverColor),
  }));
}

export function buildSavedInYearPlaylistName(prefix: string, suffix: string, year: number): string {
  return `${prefix} ${year} ${suffix}`.replace(/\s+/g, " ").trim();
}
