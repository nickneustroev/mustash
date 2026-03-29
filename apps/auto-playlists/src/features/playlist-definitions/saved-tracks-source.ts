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
    const allTracks = await this.getAllSavedTracks();
    return filterSavedTracks(allTracks, requirements);
  }

  public async getAllSavedTracks(): Promise<SavedTrackItem[]> {
    const collectedTracks: SavedTrackItem[] = [];
    let offset = 0;

    while (true) {
      const page = await this.spotifyClient.getSavedTracksPage(this.pageSize, offset);
      if (page.tracks.length === 0) {
        break;
      }

      collectedTracks.push(...page.tracks);

      if (page.tracks.length < this.pageSize || offset + page.tracks.length >= page.total) {
        break;
      }

      offset += this.pageSize;
    }

    return collectedTracks.sort((left, right) => right.addedAt.getTime() - left.addedAt.getTime());
  }
}

export function filterSavedTracks(
  tracks: SavedTrackItem[],
  requirements: SavedTracksFetchRequirements = {},
): SavedTrackItem[] {
  const sortedTracks = [...tracks].sort((left, right) => right.addedAt.getTime() - left.addedAt.getTime());
  const targetRecentCount = Math.max(0, requirements.maxRecentTracks ?? 0);
  const minSavedYear = requirements.minSavedYear;

  return sortedTracks.filter((track, index) => {
    const recentMatched = targetRecentCount > 0 && index < targetRecentCount;
    const yearMatched = minSavedYear !== undefined && track.addedAt.getUTCFullYear() >= minSavedYear;

    if (targetRecentCount > 0 && minSavedYear !== undefined) {
      return recentMatched || yearMatched;
    }

    if (targetRecentCount > 0) {
      return recentMatched;
    }

    if (minSavedYear !== undefined) {
      return yearMatched;
    }

    return true;
  });
}
