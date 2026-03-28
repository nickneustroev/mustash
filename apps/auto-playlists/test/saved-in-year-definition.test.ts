import type { SavedTrackItem } from "@spotify-helper/spotify";
import { describe, expect, it } from "vitest";
import {
  buildSavedInYearPlaylistName,
  createSavedInYearDefinitions,
} from "../src/features/saved-in-year/saved-in-year-definition.js";

function buildSavedTrack(trackId: string, addedAt: string): SavedTrackItem {
  return {
    trackId,
    trackUri: `spotify:track:${trackId}`,
    trackName: trackId,
    artistName: "Artist",
    addedAt: new Date(addedAt),
  };
}

describe("saved in year definitions", () => {
  it("builds playlist names", () => {
    expect(buildSavedInYearPlaylistName("SAVED", "[AUTO]", 2024)).toBe("SAVED 2024 [AUTO]");
  });

  it("builds playlist names without prefix when prefix is empty", () => {
    expect(buildSavedInYearPlaylistName("", "[AUTO]", 2024)).toBe("2024 [AUTO]");
  });

  it("creates yearly definitions using UTC year", () => {
    const definitions = createSavedInYearDefinitions({
      years: [2023, 2024],
      playlistPrefix: "SAVED",
      playlistSuffix: "[AUTO]",
      coverColor: "#000000",
    });

    expect(definitions).toHaveLength(2);
    expect(definitions[0]?.playlistName).toBe("SAVED 2023 [AUTO]");
    expect(
      definitions[1]?.resolveTrackUris([
        buildSavedTrack("late-2023", "2023-12-31T23:59:59.000Z"),
        buildSavedTrack("early-2024", "2024-01-01T00:00:00.000Z"),
        buildSavedTrack("mid-2024", "2024-06-01T12:00:00.000Z"),
      ]),
    ).toEqual(["spotify:track:early-2024", "spotify:track:mid-2024"]);
  });

  it("provides cover generation for yearly playlists", async () => {
    const definitions = createSavedInYearDefinitions({
      years: [2024],
      playlistPrefix: "SAVED",
      playlistSuffix: "[AUTO]",
      coverColor: "#334455",
    });

    const cover = await definitions[0]?.buildCoverJpeg?.();

    expect(cover).toBeInstanceOf(Buffer);
    expect(cover?.length).toBeGreaterThan(0);
  });
});
