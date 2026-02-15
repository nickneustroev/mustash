import type { Logger } from "./types.js";
import type { SpotifyClient } from "./spotify-client.js";

export class PlaylistManager {
  private playlistId: string | null = null;

  constructor(
    private readonly spotifyClient: SpotifyClient,
    private readonly logger: Logger,
    private readonly playlistName: string,
  ) {}

  public async ensurePlaylist(): Promise<string> {
    if (this.playlistId) {
      return this.playlistId;
    }

    const existing = await this.spotifyClient.findPlaylistByName(this.playlistName);
    if (existing) {
      this.playlistId = existing.id;
      this.logger.info(`Playlist "${this.playlistName}" found (${existing.id}).`);
      return existing.id;
    }

    const userId = await this.spotifyClient.getCurrentUserId();
    const created = await this.spotifyClient.createPlaylist(
      userId,
      this.playlistName,
      "Auto-maintained rolling history playlist.",
    );
    this.playlistId = created.id;
    this.logger.info(`Playlist "${this.playlistName}" created (${created.id}).`);
    return created.id;
  }

  public async replaceItems(trackUris: string[]): Promise<void> {
    const playlistId = await this.ensurePlaylist();
    await this.spotifyClient.replacePlaylistItems(playlistId, trackUris);
  }
}
