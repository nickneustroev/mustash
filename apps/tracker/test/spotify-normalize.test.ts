import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeCurrentlyPlaying } from "../src/spotify/spotify-client.js";

describe("normalizeCurrentlyPlaying", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes track payload", () => {
    vi.spyOn(Date, "now").mockReturnValue(123456);
    const normalized = normalizeCurrentlyPlaying({
      is_playing: true,
      currently_playing_type: "track",
      progress_ms: 9000,
      item: {
        id: "track-1",
        name: "Track 1",
        artists: [{ name: "Artist 1" }, { name: "Artist 2" }],
      },
    });

    expect(normalized).toEqual({
      isPlaying: true,
      itemType: "track",
      trackId: "track-1",
      trackUri: "spotify:track:track-1",
      trackName: "Track 1",
      artists: ["Artist 1", "Artist 2"],
      progressMs: 9000,
      fetchedAtEpochMs: 123456,
    });
  });

  it("normalizes episode payload as non-track", () => {
    const normalized = normalizeCurrentlyPlaying({
      is_playing: true,
      currently_playing_type: "episode",
      item: null,
    });

    expect(normalized.itemType).toBe("episode");
    expect(normalized.trackId).toBeNull();
    expect(normalized.trackUri).toBeNull();
    expect(normalized.artists).toEqual([]);
  });
});
