import { AuthManager } from "./auth-manager.js";
import { ConsoleNotifier } from "./console-notifier.js";
import { getSafeConfigForLogs, loadConfig } from "./config.js";
import { LikedRecentSyncService } from "./liked-recent-sync-service.js";
import { logger } from "./logger.js";
import { SpotifyClient } from "./spotify-client.js";
import { TrackWatcher } from "./track-watcher.js";
import { BackfillService } from "./backfill-service.js";
import { createPrismaClient, PrismaHistoryRepository } from "./history-repository.js";
import { createPrismaClient as createSavedTrackPrismaClient, PrismaSavedTrackRepository } from "./saved-track-repository.js";
import { PrismaArchiveRepository } from "./archive-repository.js";
import { SavedTracksSyncService } from "./saved-tracks-sync-service.js";

async function main(): Promise<void> {
  const cfg = loadConfig();
  logger.info(`Config loaded: ${JSON.stringify(getSafeConfigForLogs(cfg))}`);

  const authManager = new AuthManager(cfg, logger);
  await authManager.initialize();
  logger.info("Spotify auth is ready.");

  const spotifyClient = new SpotifyClient(authManager, cfg, logger);
  const prismaClient = createPrismaClient(cfg.databaseUrl);
  const historyRepository = new PrismaHistoryRepository(prismaClient, logger);

  const backfillService = new BackfillService(spotifyClient, historyRepository, logger, {
    intervalMs: cfg.backfillIntervalMs,
    limit: cfg.backfillLimit,
  });

  const notifier = new ConsoleNotifier(logger);
  const watcher = new TrackWatcher(spotifyClient, notifier, logger, {
    pollIntervalMs: cfg.pollIntervalMs,
    printOnStart: cfg.printOnStart,
    onNewTrack: async (snapshot) => {
      if (!snapshot.trackUri) {
        return;
      }
      await historyRepository.addLiveTrack({
        trackUri: snapshot.trackUri,
        trackName: snapshot.trackName,
        artistName: snapshot.artists[0] ?? null,
      });
    },
  });

  watcher.start();
  backfillService.start();

  const likedRecentSyncService =
    cfg.likedRecentEnabled
      ? new LikedRecentSyncService(spotifyClient, logger, {
          windows: cfg.likedRecentWindows,
          playlistPrefix: cfg.likedRecentPlaylistPrefix,
          playlistSuffix: cfg.likedRecentPlaylistSuffix,
          syncIntervalMs: cfg.likedRecentSyncIntervalMs,
          playlistPrivate: cfg.likedRecentPlaylistPrivate,
        })
      : null;

  const savedTracksRepository =
    cfg.savedTracksEnabled
      ? new PrismaSavedTrackRepository(createSavedTrackPrismaClient(cfg.databaseUrl), logger)
      : null;

  const archiveRepository =
    cfg.savedTracksEnabled
      ? new PrismaArchiveRepository(createSavedTrackPrismaClient(cfg.databaseUrl), logger)
      : null;

  const savedTracksSyncService =
    cfg.savedTracksEnabled && savedTracksRepository && archiveRepository
      ? new SavedTracksSyncService(spotifyClient, savedTracksRepository, archiveRepository, logger, {
          syncIntervalMs: cfg.savedTracksSyncIntervalMs,
        })
      : null;

  likedRecentSyncService?.start();
  savedTracksSyncService?.start();

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info(`Received ${signal}, shutting down.`);
    watcher.stop();
    likedRecentSyncService?.stop();
    savedTracksSyncService?.stop();
    backfillService.stop();
    await historyRepository.close();
    await savedTracksRepository?.close();
    await archiveRepository?.close();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

void main().catch((error) => {
  logger.error((error as Error).message);
  process.exit(1);
});
