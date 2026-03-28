import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/core/app.module.js";
import { AuthManager } from "../src/spotify/auth-manager.js";
import { BackfillService } from "../src/runtime/backfill-service.js";
import { PrismaHistoryRepository } from "../src/persistence/history-repository.js";
import { SavedTracksSyncService } from "../src/features/saved-tracks/saved-tracks-sync-service.js";
import { TrackWatcher } from "../src/runtime/track-watcher.js";

describe("Nest bootstrap lifecycle", () => {
  beforeEach(() => {
    process.env.SPOTIFY_CLIENT_ID = "test-client-id";
    process.env.SPOTIFY_CLIENT_SECRET = "test-client-secret";
    process.env.SPOTIFY_REDIRECT_URI = "http://127.0.0.1:3000/callback";
    process.env.DATABASE_URL = "file:./test-bootstrap.db";
    process.env.SAVED_TRACKS_ENABLED = "false";
    process.env.TOKEN_STORAGE_PATH = "data/.spotify-tokens.test.json";

    vi.spyOn(AuthManager.prototype, "initialize").mockResolvedValue();
    vi.spyOn(TrackWatcher.prototype, "start").mockImplementation(() => {});
    vi.spyOn(TrackWatcher.prototype, "stop").mockImplementation(() => {});
    vi.spyOn(BackfillService.prototype, "start").mockImplementation(() => {});
    vi.spyOn(BackfillService.prototype, "stop").mockImplementation(() => {});
    vi.spyOn(SavedTracksSyncService.prototype, "start").mockImplementation(() => {});
    vi.spyOn(SavedTracksSyncService.prototype, "stop").mockImplementation(() => {});
    vi.spyOn(PrismaHistoryRepository.prototype, "close").mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates and closes application context without runtime failures", async () => {
    const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

    expect(AuthManager.prototype.initialize).toHaveBeenCalledTimes(1);
    expect(TrackWatcher.prototype.start).toHaveBeenCalledTimes(1);
    expect(BackfillService.prototype.start).toHaveBeenCalledTimes(1);

    await app.close();

    expect(TrackWatcher.prototype.stop).toHaveBeenCalledTimes(1);
    expect(BackfillService.prototype.stop).toHaveBeenCalledTimes(1);
    expect(PrismaHistoryRepository.prototype.close).toHaveBeenCalledTimes(1);
  });
});
