import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AutoPlaylistsSyncService,
  hashTrackUris,
} from "../src/features/playlist-definitions/auto-playlists-sync-service.js";
import type { AutoPlaylistDefinition } from "../src/features/playlist-definitions/auto-playlist-definition.js";
import type { SavedTracksSource } from "../src/features/playlist-definitions/saved-tracks-source.js";
import type { AppStateRepository, ArchiveRepository } from "../src/persistence/types.js";
import type { Logger, SavedTrackItem } from "../src/shared/types.js";
import type { SpotifyClient } from "../src/spotify/spotify-client.js";
import { SpotifyRateLimitError } from "../src/shared/errors.js";

const log: Logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

const archiveRepository: ArchiveRepository = {
  upsertArchivedTrack: vi.fn(),
  getArchivedTrack: vi.fn().mockResolvedValue(null),
  getAllArchivedTracks: vi.fn(),
  getAllArchivedTrackIds: vi.fn(),
  getArchivedTrackCount: vi.fn(),
  close: vi.fn(),
};

const appStateRepository: AppStateRepository = {
  getValue: vi.fn().mockResolvedValue(null),
  setValue: vi.fn().mockResolvedValue(undefined),
  deleteValue: vi.fn(),
  close: vi.fn(),
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
        key: "saved-recent:2",
        playlistName: "SAVED RECENT 2 [AUTO]",
        playlistDescription: "Auto-maintained recent saved tracks (2).",
        resolveTrackUris: (savedTracks) => savedTracks.slice(0, 2).map((track) => track.trackUri),
        buildCoverJpeg: async () => Buffer.from("cover-2"),
      },
      {
        key: "saved-recent:3",
        playlistName: "SAVED RECENT 3 [AUTO]",
        playlistDescription: "Auto-maintained recent saved tracks (3).",
        resolveTrackUris: (savedTracks) => savedTracks.slice(0, 3).map((track) => track.trackUri),
        buildCoverJpeg: async () => Buffer.from("cover-3"),
      },
    ];

    const service = new AutoPlaylistsSyncService(
      spotifyClient,
      savedTracksSource,
      archiveRepository,
      appStateRepository,
      log,
      {
        definitions,
        syncIntervalMs: 15000,
        playlistPrivate: true,
        syncModeName: "fast",
      },
    );

    service.start();
    await vi.waitFor(() => {
      expect(replacePlaylistItems).toHaveBeenCalledTimes(2);
    });
    await service.syncNow();
    service.stop();

    expect(replacePlaylistItems).toHaveBeenCalledTimes(2);
    expect(uploadPlaylistCoverImage).toHaveBeenCalledTimes(2);
    expect(appStateRepository.setValue).toHaveBeenCalledTimes(0);
    expect(log.info).toHaveBeenCalledWith("Sync cycle started (fast).");
    expect(log.info).toHaveBeenCalledWith("Sync cycle completed (fast, updated=0/2).");
  });

  it("archives removed tracks from previous snapshot", async () => {
    const spotifyClient = {
      getCurrentUserId: vi.fn().mockResolvedValue("user-1"),
      findPlaylistByName: vi.fn().mockResolvedValue({ id: "p2", name: "SAVED RECENT 2 [AUTO]" }),
      createPlaylist: vi.fn(),
      replacePlaylistItems: vi.fn().mockResolvedValue(undefined),
      uploadPlaylistCoverImage: vi.fn(),
    } as unknown as SpotifyClient;

    const savedTracksSource = {
      getSavedTracks: vi.fn().mockResolvedValue([buildSavedTrack("a")]),
    } as unknown as SavedTracksSource;

    const localAppState: AppStateRepository = {
      ...appStateRepository,
      getValue: vi.fn().mockResolvedValue(
        JSON.stringify([
          {
            trackId: "a",
            trackUri: "spotify:track:a",
            trackName: "a",
            artistName: "Artist",
            addedAtIso: new Date("2026-03-28T00:00:01.000Z").toISOString(),
          },
          {
            trackId: "bb",
            trackUri: "spotify:track:bb",
            trackName: "bb",
            artistName: "Artist",
            addedAtIso: new Date("2026-03-28T00:00:02.000Z").toISOString(),
          },
        ]),
      ),
      setValue: vi.fn().mockResolvedValue(undefined),
    };

    const localArchive: ArchiveRepository = {
      ...archiveRepository,
      getArchivedTrack: vi.fn().mockResolvedValue(null),
      upsertArchivedTrack: vi.fn().mockResolvedValue(undefined),
    };

    const service = new AutoPlaylistsSyncService(
      spotifyClient,
      savedTracksSource,
      localArchive,
      localAppState,
      log,
      {
        definitions: [
          {
            key: "saved-recent:2",
            playlistName: "SAVED RECENT 2 [AUTO]",
            playlistDescription: "Auto-maintained recent saved tracks (2).",
            resolveTrackUris: (savedTracks) => savedTracks.slice(0, 2).map((track) => track.trackUri),
          },
        ],
        syncIntervalMs: 15000,
        playlistPrivate: true,
        syncModeName: "full",
        syncRemovedTracksArchive: true,
      },
    );

    (service as unknown as { stopped: boolean }).stopped = false;
    await service.syncNow();

    expect(localArchive.upsertArchivedTrack).toHaveBeenCalledTimes(1);
    expect(localArchive.upsertArchivedTrack).toHaveBeenCalledWith(
      expect.objectContaining({ trackId: "bb", trackUri: "spotify:track:bb" }),
    );
    expect(log.info).toHaveBeenCalledWith("Archived removed track: Artist - bb (bb).");
  });

  it("hashes uri arrays deterministically", () => {
    expect(hashTrackUris(["a", "b"])).toBe(hashTrackUris(["a", "b"]));
    expect(hashTrackUris(["a", "b"])).not.toBe(hashTrackUris(["b", "a"]));
  });

  it("logs completed sync with updated playlist count", async () => {
    const spotifyClient = {
      getCurrentUserId: vi.fn().mockResolvedValue("user-1"),
      findPlaylistByName: vi.fn().mockResolvedValue({ id: "p2", name: "SAVED RECENT 2 [AUTO]" }),
      createPlaylist: vi.fn(),
      replacePlaylistItems: vi.fn().mockResolvedValue(undefined),
      uploadPlaylistCoverImage: vi.fn(),
    } as unknown as SpotifyClient;

    const savedTracksSource = {
      getSavedTracks: vi.fn().mockResolvedValue([buildSavedTrack("a")]),
    } as unknown as SavedTracksSource;

    const service = new AutoPlaylistsSyncService(
      spotifyClient,
      savedTracksSource,
      archiveRepository,
      appStateRepository,
      log,
      {
        definitions: [
          {
            key: "saved-recent:2",
            playlistName: "SAVED RECENT 2 [AUTO]",
            playlistDescription: "Auto-maintained recent saved tracks (2).",
            resolveTrackUris: (savedTracks) => savedTracks.slice(0, 2).map((track) => track.trackUri),
          },
        ],
        syncIntervalMs: 15000,
        playlistPrivate: true,
        syncModeName: "full",
        syncRemovedTracksArchive: true,
      },
    );

    (service as unknown as { stopped: boolean }).stopped = false;
    await service.syncNow();

    expect(log.info).toHaveBeenCalledWith("Sync cycle started (full).");
    expect(log.info).toHaveBeenCalledWith('Synced "SAVED RECENT 2 [AUTO]" - 1 items.');
    expect(log.info).toHaveBeenCalledWith("Sync cycle completed (full, updated=1/1).");
  });

  it("uses saved track requirements instead of forcing full catalog fetch", async () => {
    const spotifyClient = {
      getCurrentUserId: vi.fn().mockResolvedValue("user-1"),
      findPlaylistByName: vi.fn().mockResolvedValue({ id: "p2", name: "SAVED RECENT 2 [AUTO]" }),
      createPlaylist: vi.fn(),
      replacePlaylistItems: vi.fn().mockResolvedValue(undefined),
      uploadPlaylistCoverImage: vi.fn(),
    } as unknown as SpotifyClient;

    const getSavedTracks = vi.fn().mockResolvedValue([buildSavedTrack("a"), buildSavedTrack("bb")]);
    const savedTracksSource = {
      getSavedTracks,
      getAllSavedTracks: vi.fn(),
    } as unknown as SavedTracksSource;

    const service = new AutoPlaylistsSyncService(
      spotifyClient,
      savedTracksSource,
      archiveRepository,
      appStateRepository,
      log,
      {
        definitions: [
          {
            key: "saved-recent:2",
            playlistName: "SAVED RECENT 2 [AUTO]",
            playlistDescription: "Auto-maintained recent saved tracks (2).",
            resolveTrackUris: (savedTracks) => savedTracks.slice(0, 2).map((track) => track.trackUri),
          },
        ],
        syncIntervalMs: 15000,
        playlistPrivate: true,
        syncModeName: "fast",
        savedTracksRequirements: { maxRecentTracks: 2 },
      },
    );

    (service as unknown as { stopped: boolean }).stopped = false;
    await service.syncNow();

    expect(getSavedTracks).toHaveBeenCalledWith({ maxRecentTracks: 2 });
  });

  it("backs off when Spotify rate limits the current sync mode", async () => {
    const spotifyClient = {
      getCurrentUserId: vi.fn().mockRejectedValue(new SpotifyRateLimitError(30)),
      findPlaylistByName: vi.fn(),
      createPlaylist: vi.fn(),
      replacePlaylistItems: vi.fn(),
      uploadPlaylistCoverImage: vi.fn(),
    } as unknown as SpotifyClient;

    const savedTracksSource = {
      getSavedTracks: vi.fn(),
    } as unknown as SavedTracksSource;

    const service = new AutoPlaylistsSyncService(
      spotifyClient,
      savedTracksSource,
      archiveRepository,
      appStateRepository,
      log,
      {
        definitions: [
          {
            key: "saved-recent:2",
            playlistName: "SAVED RECENT 2 [AUTO]",
            playlistDescription: "Auto-maintained recent saved tracks (2).",
            resolveTrackUris: () => [],
          },
        ],
        syncIntervalMs: 15000,
        playlistPrivate: true,
        syncModeName: "fast",
      },
    );

    (service as unknown as { stopped: boolean }).stopped = false;
    await service.syncNow();

    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("Sync rate-limited. Retry after 30s."));
  });
});
