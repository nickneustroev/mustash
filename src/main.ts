import { AuthManager } from "./auth-manager.js";
import { ConsoleNotifier } from "./console-notifier.js";
import { getSafeConfigForLogs, loadConfig } from "./config.js";
import { HistoryStore } from "./history-store.js";
import { logger } from "./logger.js";
import { PlaylistManager } from "./playlist-manager.js";
import { PlaylistSyncScheduler } from "./playlist-sync-scheduler.js";
import { SpotifyClient } from "./spotify-client.js";
import { TrackWatcher } from "./track-watcher.js";

async function main(): Promise<void> {
  const cfg = loadConfig();
  logger.info(`Config loaded: ${JSON.stringify(getSafeConfigForLogs(cfg))}`);

  const authManager = new AuthManager(cfg, logger);
  await authManager.initialize();
  logger.info("Spotify auth is ready.");

  const spotifyClient = new SpotifyClient(authManager, cfg, logger);
  const historyStore = new HistoryStore(cfg.historyStatePath, cfg.historyMaxItems, logger);
  await historyStore.load();

  const playlistManager = new PlaylistManager(spotifyClient, logger, cfg.historyPlaylistName);
  await playlistManager.ensurePlaylist();

  const syncScheduler = new PlaylistSyncScheduler(
    cfg.playlistSyncDebounceMs,
    () => historyStore.getTrackUris(),
    async (trackUris) => {
      await playlistManager.replaceItems(trackUris);
    },
    logger,
  );

  const notifier = new ConsoleNotifier(logger);
  const watcher = new TrackWatcher(spotifyClient, notifier, logger, {
    pollIntervalMs: cfg.pollIntervalMs,
    printOnStart: cfg.printOnStart,
    onNewTrack: async (snapshot) => {
      if (!snapshot.trackUri) {
        return;
      }
      const changed = historyStore.addLiveTrack(snapshot.trackUri);
      if (!changed) {
        return;
      }
      await historyStore.save();
      syncScheduler.markDirty();
    },
  });

  syncScheduler.markDirty();
  watcher.start();

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info(`Received ${signal}, shutting down.`);
    watcher.stop();
    await syncScheduler.stop();
    await historyStore.save();
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
