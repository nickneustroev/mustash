import type { SavedTrackItem } from "@spotify-helper/spotify";
import { describe, expect, it } from "vitest";
import {
  buildLikedRecentPlaylistName,
  createLikedRecentDefinitions,
} from "../src/features/liked-recent/liked-recent-definition.js";

function buildSavedTrack(trackId: string): SavedTrackItem {
  return {
    trackId,
    trackUri: `spotify:track:${trackId}`,
    trackName: trackId,
    artistName: "Artist",
    addedAt: new Date(),
  };
}

describe("liked recent definitions", () => {
  it("builds playlist names", () => {
    expect(buildLikedRecentPlaylistName("LIKED RECENT", "[AUTO]", 20)).toBe(
      "LIKED RECENT 20 [AUTO]",
    );
  });

  it("creates ordered recent-liked definitions", () => {
    const definitions = createLikedRecentDefinitions({
      windows: [2, 3],
      playlistPrefix: "LIKED RECENT",
      playlistSuffix: "[AUTO]",
    });

    expect(definitions).toHaveLength(2);
    expect(definitions[0]?.playlistName).toBe("LIKED RECENT 2 [AUTO]");
    expect(
      definitions[1]?.resolveTrackUris([
        buildSavedTrack("a"),
        buildSavedTrack("bb"),
        buildSavedTrack("ccc"),
      ]),
    ).toEqual(["spotify:track:a", "spotify:track:bb", "spotify:track:ccc"]);
  });
});
