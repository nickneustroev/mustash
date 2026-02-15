import { describe, expect, it, vi } from "vitest";
import { PlaylistManager } from "../src/playlist-manager.js";
import type { Logger } from "../src/types.js";
import type { SpotifyClient } from "../src/spotify-client.js";

const log: Logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe("PlaylistManager", () => {
  it("creates playlist when missing", async () => {
    const findPlaylistByName = vi.fn().mockResolvedValue(null);
    const getCurrentUserId = vi.fn().mockResolvedValue("user-1");
    const createPlaylist = vi.fn().mockResolvedValue({ id: "playlist-1", name: "HISTORY [AUTO]" });
    const replacePlaylistItems = vi.fn().mockResolvedValue(undefined);

    const spotifyClient = {
      findPlaylistByName,
      getCurrentUserId,
      createPlaylist,
      replacePlaylistItems,
    } as unknown as SpotifyClient;

    const manager = new PlaylistManager(spotifyClient, log, "HISTORY [AUTO]");
    const playlistId = await manager.ensurePlaylist();
    await manager.replaceItems(["spotify:track:a"]);

    expect(playlistId).toBe("playlist-1");
    expect(createPlaylist).toHaveBeenCalledTimes(1);
    expect(replacePlaylistItems).toHaveBeenCalledWith("playlist-1", ["spotify:track:a"]);
  });
});
