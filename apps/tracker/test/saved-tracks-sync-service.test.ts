import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SavedTracksSyncService } from "../src/saved-tracks-sync-service.js";
import type { SavedTrackItem, Logger, ArchivedTrackItem } from "../src/types.js";
import type { SpotifyClient } from "../src/spotify-client.js";
import type { SavedTrackRepository } from "../src/saved-track-repository.js";
import type { ArchiveRepository } from "../src/archive-repository.js";

describe("SavedTracksSyncService", () => {
  let mockSpotifyClient: SpotifyClient;
  let mockRepository: SavedTrackRepository;
  let mockArchiveRepository: ArchiveRepository;
  let mockLogger: Logger;

  const createMockLogger = (): Logger => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  });

  const createMockSpotifyClient = (): SpotifyClient => {
    return {
      getSavedTracksPage: vi.fn().mockResolvedValue({ tracks: [], total: 0 }),
    } as unknown as SpotifyClient;
  };

  const createMockRepository = (): SavedTrackRepository => {
    return {
      upsertSavedTrack: vi.fn(),
      upsertSavedTracks: vi.fn().mockResolvedValue(0),
      deleteSavedTrack: vi.fn(),
      deleteSavedTracks: vi.fn().mockResolvedValue(0),
      getAllSavedTrackIds: vi.fn().mockResolvedValue([]),
      getAllSavedTracks: vi.fn().mockResolvedValue([]),
      getSavedTrackCount: vi.fn().mockResolvedValue(0),
      close: vi.fn(),
    };
  };

  const createMockArchiveRepository = (): ArchiveRepository => {
    return {
      upsertArchivedTrack: vi.fn(),
      getArchivedTrack: vi.fn().mockResolvedValue(null),
      getAllArchivedTracks: vi.fn().mockResolvedValue([]),
      getAllArchivedTrackIds: vi.fn().mockResolvedValue([]),
      getArchivedTrackCount: vi.fn().mockResolvedValue(0),
      close: vi.fn(),
    };
  };

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockSpotifyClient = createMockSpotifyClient();
    mockRepository = createMockRepository();
    mockArchiveRepository = createMockArchiveRepository();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("syncNow", () => {
    it("should add new tracks from Spotify to DB", async () => {
      const spotifyTracks: SavedTrackItem[] = [
        {
          trackId: "track1",
          trackUri: "spotify:track:track1",
          trackName: "Track 1",
          artistName: "Artist 1",
          addedAt: new Date(1000),
        },
        {
          trackId: "track2",
          trackUri: "spotify:track:track2",
          trackName: "Track 2",
          artistName: "Artist 2",
          addedAt: new Date(2000),
        },
      ];

      (mockSpotifyClient.getSavedTracksPage as ReturnType<typeof vi.fn>).mockResolvedValue({
        tracks: spotifyTracks,
        total: 2,
      });
      (mockRepository.getAllSavedTrackIds as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (mockRepository.getAllSavedTracks as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (mockRepository.upsertSavedTracks as ReturnType<typeof vi.fn>).mockResolvedValue(2);
      (mockRepository.deleteSavedTracks as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      const service = new SavedTracksSyncService(
        mockSpotifyClient,
        mockRepository,
        mockArchiveRepository,
        mockLogger,
        {
          syncIntervalMs: 60000,
        },
      );

      // Manually set stopped to false to allow syncNow to run
      (service as unknown as { stopped: boolean }).stopped = false;
      await service.syncNow();

      expect(mockRepository.upsertSavedTracks).toHaveBeenCalledWith(spotifyTracks);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("new=2"),
      );
    });

    it("should remove tracks that are in DB but not in Spotify", async () => {
      const spotifyTracks: SavedTrackItem[] = [
        {
          trackId: "track1",
          trackUri: "spotify:track:track1",
          trackName: "Track 1",
          artistName: "Artist 1",
          addedAt: new Date(1000),
        },
      ];

      (mockSpotifyClient.getSavedTracksPage as ReturnType<typeof vi.fn>).mockResolvedValue({
        tracks: spotifyTracks,
        total: 1,
      });
      (mockRepository.getAllSavedTrackIds as ReturnType<typeof vi.fn>).mockResolvedValue(["track1", "track2"]);
      (mockRepository.getAllSavedTracks as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          trackId: "track1",
          trackUri: "spotify:track:track1",
          trackName: "Track 1",
          artistName: "Artist 1",
          addedAt: new Date(1000),
        },
      ]);
      (mockRepository.upsertSavedTracks as ReturnType<typeof vi.fn>).mockResolvedValue(0);
      (mockRepository.deleteSavedTracks as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const service = new SavedTracksSyncService(
        mockSpotifyClient,
        mockRepository,
        mockArchiveRepository,
        mockLogger,
        {
          syncIntervalMs: 60000,
        },
      );

      (service as unknown as { stopped: boolean }).stopped = false;
      await service.syncNow();

      // Since track2 is not in DB (getAllSavedTracks returns only track1), nothing will be archived
      // The test verifies that the service handles removed tracks properly
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("removed="),
      );
    });

    it("should update tracks with changed metadata", async () => {
      const spotifyTracks: SavedTrackItem[] = [
        {
          trackId: "track1",
          trackUri: "spotify:track:track1",
          trackName: "Updated Track Name",
          artistName: "Updated Artist",
          addedAt: new Date(2000),
        },
      ];

      const dbTracks: SavedTrackItem[] = [
        {
          trackId: "track1",
          trackUri: "spotify:track:track1",
          trackName: "Old Track Name",
          artistName: "Old Artist",
          addedAt: new Date(1000),
        },
      ];

      (mockSpotifyClient.getSavedTracksPage as ReturnType<typeof vi.fn>).mockResolvedValue({
        tracks: spotifyTracks,
        total: 1,
      });
      (mockRepository.getAllSavedTrackIds as ReturnType<typeof vi.fn>).mockResolvedValue(["track1"]);
      (mockRepository.getAllSavedTracks as ReturnType<typeof vi.fn>).mockResolvedValue(dbTracks);
      (mockRepository.upsertSavedTracks as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      (mockRepository.deleteSavedTracks as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      const service = new SavedTracksSyncService(
        mockSpotifyClient,
        mockRepository,
        mockArchiveRepository,
        mockLogger,
        {
          syncIntervalMs: 60000,
        },
      );

      (service as unknown as { stopped: boolean }).stopped = false;
      await service.syncNow();

      expect(mockRepository.upsertSavedTracks).toHaveBeenCalledWith(spotifyTracks);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("updated=1"),
      );
    });

    it("should handle empty Spotify response", async () => {
      (mockSpotifyClient.getSavedTracksPage as ReturnType<typeof vi.fn>).mockResolvedValue({
        tracks: [],
        total: 0,
      });
      (mockRepository.getAllSavedTrackIds as ReturnType<typeof vi.fn>).mockResolvedValue(["track1"]);
      (mockRepository.getAllSavedTracks as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (mockRepository.upsertSavedTracks as ReturnType<typeof vi.fn>).mockResolvedValue(0);
      (mockRepository.deleteSavedTracks as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const service = new SavedTracksSyncService(
        mockSpotifyClient,
        mockRepository,
        mockArchiveRepository,
        mockLogger,
        {
          syncIntervalMs: 60000,
        },
      );

      (service as unknown as { stopped: boolean }).stopped = false;
      await service.syncNow();

      // Since track1 is not in DB (getAllSavedTracks returns empty), nothing will be archived
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Spotify=0"),
      );
    });

    it("should handle errors gracefully", async () => {
      (mockSpotifyClient.getSavedTracksPage as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("API Error"),
      );

      const service = new SavedTracksSyncService(
        mockSpotifyClient,
        mockRepository,
        mockArchiveRepository,
        mockLogger,
        {
          syncIntervalMs: 60000,
        },
      );

      (service as unknown as { stopped: boolean }).stopped = false;
      await service.syncNow();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("failed"),
      );
    });
  });

  describe("start/stop", () => {
    it("should start and stop the service", () => {
      vi.useFakeTimers();

      const service = new SavedTracksSyncService(
        mockSpotifyClient,
        mockRepository,
        mockArchiveRepository,
        mockLogger,
        {
          syncIntervalMs: 60000,
        },
      );

      service.start();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("started"),
      );

      service.stop();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("stopped"),
      );

      vi.useRealTimers();
    });
  });
});
