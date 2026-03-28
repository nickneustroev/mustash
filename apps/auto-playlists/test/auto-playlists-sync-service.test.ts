import type { SavedTrackItem } from "@spotify-helper/spotify";
import { describe, expect, it, vi } from "vitest";
import {
  AutoPlaylistsSyncService,
  hashTrackUris,
} from "../src/features/playlist-definitions/auto-playlists-sync-service.js";
import type { AutoPlaylistDefinition } from "../src/features/playlist-definitions/auto-playlist-definition.js";
import type { SavedTracksSource } from "../src/features/playlist-definitions/saved-tracks-source.js";
import type { Logger } from "../src/shared/types.js";
import type { SpotifyClient } from "../src/spotify/spotify-client.js";

const log: Logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

function buildSavedTrack(trackId: string): SavedTrackItem {
  return {
    trackId,
    trackUri: `spotify:track:${trackId}`,
    trackName: trackId,
    artistName: "Artist",
    addedAt: new Date(`2026-03-28T00:00:0${trackId.length}.000Z`),
  };
}

describe("AutoPlaylistsSyncService", () => {
  it("skips replace calls when playlist content did not change", async () => {
    const getCurrentUserId = vi.fn().mockResolvedValue("user-1");
    const findPlaylistByName = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    const createPlaylist = vi
      .fn()
      .mockResolvedValueOnce({ id: "p2", name: "LIKED RECENT 2 [AUTO]" })
      .mockResolvedValueOnce({ id: "p3", name: "LIKED RECENT 3 [AUTO]" });
    const replacePlaylistItems = vi.fn().mockResolvedValue(undefined);
    const uploadPlaylistCoverImage = vi.fn().mockResolvedValue(undefined);

    const spotifyClient = {
      getCurrentUserId,
      findPlaylistByName,
      createPlaylist,
      replacePlaylistItems,
      uploadPlaylistCoverImage,
    } as unknown as SpotifyClient;

    const savedTracksSource = {
      getSavedTracks: vi
        .fn()
        .mockResolvedValueOnce([buildSavedTrack("a"), buildSavedTrack("bb"), buildSavedTrack("ccc")])
        .mockResolvedValueOnce([buildSavedTrack("a"), buildSavedTrack("bb"), buildSavedTrack("ccc")]),
    } as unknown as SavedTracksSource;

    const definitions: AutoPlaylistDefinition[] = [
      {
        key: "liked-recent:2",
        playlistName: "LIKED RECENT 2 [AUTO]",
        playlistDescription: "Auto-maintained recent liked tracks (2).",
        resolveTrackUris: (savedTracks) => savedTracks.slice(0, 2).map((track) => track.trackUri),
        buildCoverJpeg: async () => Buffer.from("cover-2"),
      },
      {
        key: "liked-recent:3",
        playlistName: "LIKED RECENT 3 [AUTO]",
        playlistDescription: "Auto-maintained recent liked tracks (3).",
        resolveTrackUris: (savedTracks) => savedTracks.slice(0, 3).map((track) => track.trackUri),
        buildCoverJpeg: async () => Buffer.from("cover-3"),
      },
    ];

    const service = new AutoPlaylistsSyncService(spotifyClient, savedTracksSource, log, {
      definitions,
      syncIntervalMs: 15000,
      playlistPrivate: true,
    });

    service.start();
    await vi.waitFor(() => {
      expect(replacePlaylistItems).toHaveBeenCalledTimes(2);
    });
    await service.syncNow();
    service.stop();

    expect(replacePlaylistItems).toHaveBeenCalledTimes(2);
    expect(uploadPlaylistCoverImage).toHaveBeenCalledTimes(2);
  });

  it("does not upload cover when playlist already exists", async () => {
    const getCurrentUserId = vi.fn().mockResolvedValue("user-1");
    const findPlaylistByName = vi.fn().mockResolvedValueOnce({ id: "p2", name: "LIKED RECENT 2 [AUTO]" });
    const createPlaylist = vi.fn().mockResolvedValue({ id: "unused", name: "unused" });
    const replacePlaylistItems = vi.fn().mockResolvedValue(undefined);
    const uploadPlaylistCoverImage = vi.fn().mockResolvedValue(undefined);

    const spotifyClient = {
      getCurrentUserId,
      findPlaylistByName,
      createPlaylist,
      replacePlaylistItems,
      uploadPlaylistCoverImage,
    } as unknown as SpotifyClient;

    const savedTracksSource = {
      getSavedTracks: vi.fn().mockResolvedValue([buildSavedTrack("a"), buildSavedTrack("bb")]),
    } as unknown as SavedTracksSource;

    const service = new AutoPlaylistsSyncService(spotifyClient, savedTracksSource, log, {
      definitions: [
        {
          key: "liked-recent:2",
          playlistName: "LIKED RECENT 2 [AUTO]",
          playlistDescription: "Auto-maintained recent liked tracks (2).",
          resolveTrackUris: (savedTracks) => savedTracks.slice(0, 2).map((track) => track.trackUri),
          buildCoverJpeg: async () => Buffer.from("cover-2"),
        },
      ],
      syncIntervalMs: 15000,
      playlistPrivate: true,
    });

    await service.syncNow();

    expect(createPlaylist).toHaveBeenCalledTimes(0);
    expect(uploadPlaylistCoverImage).toHaveBeenCalledTimes(0);
  });

  it("hashes uri arrays deterministically", () => {
    expect(hashTrackUris(["a", "b"])).toBe(hashTrackUris(["a", "b"]));
    expect(hashTrackUris(["a", "b"])).not.toBe(hashTrackUris(["b", "a"]));
  });
});
