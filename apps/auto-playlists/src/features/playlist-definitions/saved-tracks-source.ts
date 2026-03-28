import type { SavedTrackItem } from "@spotify-helper/spotify";
import type { SpotifyClient } from "../../spotify/spotify-client.js";

export interface SavedTracksFetchRequirements {
  maxRecentTracks?: number;
  minSavedYear?: number;
}

export class SavedTracksSource {
  constructor(
    private readonly spotifyClient: SpotifyClient,
    private readonly pageSize = 50,
  ) {}

  public async getSavedTracks(requirements: SavedTracksFetchRequirements = {}): Promise<SavedTrackItem[]> {
    const collectedTracks: SavedTrackItem[] = [];
    let offset = 0;
    const targetRecentCount = Math.max(0, requirements.maxRecentTracks ?? 0);
    const minSavedYear = requirements.minSavedYear;
    const hasCustomStopCondition = targetRecentCount > 0 || minSavedYear !== undefined;
    let fetchedTrackCount = 0;

    while (true) {
      const page = await this.spotifyClient.getSavedTracksPage(this.pageSize, offset);
      if (page.tracks.length === 0) {
        break;
      }

      fetchedTrackCount += page.tracks.length;

      const filteredTracks = targetRecentCount > 0 || minSavedYear === undefined
        ? page.tracks
        : page.tracks.filter((track) => track.addedAt.getUTCFullYear() >= minSavedYear);

      collectedTracks.push(...filteredTracks);

      const lastTrack = page.tracks[page.tracks.length - 1];
      const recentSatisfied = targetRecentCount === 0 || fetchedTrackCount >= targetRecentCount;
      const yearSatisfied =
        minSavedYear === undefined || (lastTrack !== undefined && lastTrack.addedAt.getUTCFullYear() < minSavedYear);

      if (
        page.tracks.length < this.pageSize ||
        offset + page.tracks.length >= page.total ||
        (hasCustomStopCondition && recentSatisfied && yearSatisfied)
      ) {
        break;
      }

      offset += this.pageSize;
    }

    return collectedTracks.sort((left, right) => right.addedAt.getTime() - left.addedAt.getTime());
  }
}
