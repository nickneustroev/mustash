import type { SavedTrackItem } from "@spotify-helper/spotify";
import { describe, expect, it } from "vitest";
import {
  buildSavedRecentPlaylistName,
  createSavedRecentDefinitions,
} from "../src/features/saved-recent/saved-recent-definition.js";

function buildSavedTrack(trackId: string): SavedTrackItem {
  return {
    trackId,
    trackUri: `spotify:track:${trackId}`,
    trackName: trackId,
    artistName: "Artist",
    addedAt: new Date(),
  };
}

describe("saved recent definitions", () => {
  it("builds playlist names", () => {
    expect(buildSavedRecentPlaylistName("SAVED", "[AUTO]", 20)).toBe("SAVED RECENT 20 [AUTO]");
  });

  it("creates ordered saved recent definitions", () => {
    const definitions = createSavedRecentDefinitions({
      windows: [2, 3],
      playlistPrefix: "SAVED",
      playlistSuffix: "[AUTO]",
    });

    expect(definitions).toHaveLength(2);
    expect(definitions[0]?.playlistName).toBe("SAVED RECENT 2 [AUTO]");
    expect(
      definitions[1]?.resolveTrackUris([
        buildSavedTrack("a"),
        buildSavedTrack("bb"),
        buildSavedTrack("ccc"),
      ]),
    ).toEqual(["spotify:track:a", "spotify:track:bb", "spotify:track:ccc"]);
  });
});
