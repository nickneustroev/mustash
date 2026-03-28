import type { SavedTrackItem } from "@spotify-helper/spotify";
import { describe, expect, it, vi } from "vitest";
import { SavedTracksSource } from "../src/features/playlist-definitions/saved-tracks-source.js";
import type { SpotifyClient } from "../src/spotify/spotify-client.js";

function buildSavedTrack(trackId: string, addedAt: string): SavedTrackItem {
  return {
    trackId,
    trackUri: `spotify:track:${trackId}`,
    trackName: trackId,
    artistName: "Artist",
    addedAt: new Date(addedAt),
  };
}

describe("SavedTracksSource", () => {
  it("loads only enough tracks for recent-only requirements", async () => {
    const getSavedTracksPage = vi
      .fn()
      .mockResolvedValueOnce({
        tracks: [
          buildSavedTrack("a", "2024-05-01T10:00:00.000Z"),
          buildSavedTrack("b", "2024-04-01T10:00:00.000Z"),
          buildSavedTrack("c", "2024-03-01T10:00:00.000Z"),
        ],
        total: 6,
      })
      .mockResolvedValueOnce({
        tracks: [
          buildSavedTrack("d", "2024-02-01T10:00:00.000Z"),
          buildSavedTrack("e", "2024-01-01T10:00:00.000Z"),
          buildSavedTrack("f", "2023-12-01T10:00:00.000Z"),
        ],
        total: 6,
      });

    const source = new SavedTracksSource({ getSavedTracksPage } as unknown as SpotifyClient, 3);
    const tracks = await source.getSavedTracks({ maxRecentTracks: 3 });

    expect(getSavedTracksPage).toHaveBeenCalledTimes(1);
    expect(tracks.map((track) => track.trackId)).toEqual(["a", "b", "c"]);
  });

  it("stops when yearly requirements cross the minimum year boundary", async () => {
    const getSavedTracksPage = vi
      .fn()
      .mockResolvedValueOnce({
        tracks: [
          buildSavedTrack("a", "2024-07-01T10:00:00.000Z"),
          buildSavedTrack("b", "2024-03-01T10:00:00.000Z"),
          buildSavedTrack("c", "2023-12-01T10:00:00.000Z"),
        ],
        total: 6,
      })
      .mockResolvedValueOnce({
        tracks: [
          buildSavedTrack("d", "2023-02-01T10:00:00.000Z"),
          buildSavedTrack("e", "2022-10-01T10:00:00.000Z"),
          buildSavedTrack("f", "2022-06-01T10:00:00.000Z"),
        ],
        total: 6,
      })
      .mockResolvedValueOnce({
        tracks: [buildSavedTrack("g", "2021-01-01T10:00:00.000Z")],
        total: 7,
      });

    const source = new SavedTracksSource({ getSavedTracksPage } as unknown as SpotifyClient, 3);
    const tracks = await source.getSavedTracks({ minSavedYear: 2023 });

    expect(getSavedTracksPage).toHaveBeenCalledTimes(2);
    expect(tracks.map((track) => track.trackId)).toEqual(["a", "b", "c", "d"]);
  });

  it("keeps loading until both recent and yearly requirements are satisfied", async () => {
    const getSavedTracksPage = vi
      .fn()
      .mockResolvedValueOnce({
        tracks: [
          buildSavedTrack("a", "2024-07-01T10:00:00.000Z"),
          buildSavedTrack("b", "2024-06-01T10:00:00.000Z"),
        ],
        total: 6,
      })
      .mockResolvedValueOnce({
        tracks: [
          buildSavedTrack("c", "2024-01-01T10:00:00.000Z"),
          buildSavedTrack("d", "2023-03-01T10:00:00.000Z"),
        ],
        total: 6,
      })
      .mockResolvedValueOnce({
        tracks: [
          buildSavedTrack("e", "2022-12-01T10:00:00.000Z"),
          buildSavedTrack("f", "2022-01-01T10:00:00.000Z"),
        ],
        total: 6,
      });

    const source = new SavedTracksSource({ getSavedTracksPage } as unknown as SpotifyClient, 2);
    const tracks = await source.getSavedTracks({ maxRecentTracks: 5, minSavedYear: 2023 });

    expect(getSavedTracksPage).toHaveBeenCalledTimes(3);
    expect(tracks.map((track) => track.trackId)).toEqual(["a", "b", "c", "d", "e", "f"]);
  });

  it("loads all tracks when no requirements are provided", async () => {
    const getSavedTracksPage = vi
      .fn()
      .mockResolvedValueOnce({
        tracks: [
          buildSavedTrack("a", "2024-07-01T10:00:00.000Z"),
          buildSavedTrack("b", "2024-06-01T10:00:00.000Z"),
        ],
        total: 4,
      })
      .mockResolvedValueOnce({
        tracks: [
          buildSavedTrack("c", "2024-01-01T10:00:00.000Z"),
          buildSavedTrack("d", "2023-03-01T10:00:00.000Z"),
        ],
        total: 4,
      });

    const source = new SavedTracksSource({ getSavedTracksPage } as unknown as SpotifyClient, 2);
    const tracks = await source.getSavedTracks();

    expect(getSavedTracksPage).toHaveBeenCalledTimes(2);
    expect(tracks.map((track) => track.trackId)).toEqual(["a", "b", "c", "d"]);
  });
});
