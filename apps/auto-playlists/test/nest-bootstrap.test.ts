import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/core/app.module.js";
import { AutoPlaylistsSyncService } from "../src/features/playlist-definitions/auto-playlists-sync-service.js";
import { AuthManager } from "../src/spotify/auth-manager.js";

describe("Nest bootstrap lifecycle", () => {
  beforeEach(() => {
    process.env.SPOTIFY_CLIENT_ID = "test-client-id";
    process.env.SPOTIFY_CLIENT_SECRET = "test-client-secret";
    process.env.SPOTIFY_REDIRECT_URI = "http://127.0.0.1:3000/callback";
    process.env.TOKEN_STORAGE_PATH = "data/.spotify-tokens.test.json";
    process.env.SAVED_RECENT_WINDOWS = "20,50,100";

    vi.spyOn(AuthManager.prototype, "initialize").mockResolvedValue();
    vi.spyOn(AutoPlaylistsSyncService.prototype, "start").mockImplementation(() => {});
    vi.spyOn(AutoPlaylistsSyncService.prototype, "stop").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates and closes application context without runtime failures", async () => {
    const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

    expect(AuthManager.prototype.initialize).toHaveBeenCalledTimes(1);
    expect(AutoPlaylistsSyncService.prototype.start).toHaveBeenCalledTimes(1);

    await app.close();

    expect(AutoPlaylistsSyncService.prototype.stop).toHaveBeenCalledTimes(1);
  });
});
