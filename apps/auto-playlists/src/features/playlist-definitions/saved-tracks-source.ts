import type { SavedTrackItem } from "@spotify-helper/spotify";
import type { SpotifyClient } from "../../spotify/spotify-client.js";

export class SavedTracksSource {
  constructor(private readonly spotifyClient: SpotifyClient) {}

  public async getSavedTracks(): Promise<SavedTrackItem[]> {
    const allTracks: SavedTrackItem[] = [];
    let offset = 0;
    const pageSize = 50;

    while (true) {
      const page = await this.spotifyClient.getSavedTracksPage(pageSize, offset);
      allTracks.push(...page.tracks);

      if (page.tracks.length < pageSize || allTracks.length >= page.total) {
        break;
      }
      offset += pageSize;
    }

    return allTracks.sort((left, right) => right.addedAt.getTime() - left.addedAt.getTime());
  }
}
