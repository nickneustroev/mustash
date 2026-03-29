import type { PrismaClient } from "@prisma/client";
import type { Logger } from "@spotify-helper/spotify";
import type { ArchivedTrackItem } from "./types.js";
export class PrismaArchiveRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger,
  ) {}

  public async upsertArchivedTrack(track: ArchivedTrackItem): Promise<void> {
    await this.prisma.archivedTrack.upsert({
      where: { trackId: track.trackId },
      update: {
        trackUri: track.trackUri,
        trackName: track.trackName,
        artistName: track.artistName,
        addedAt: track.addedAt,
        removedAt: track.removedAt,
      },
      create: {
        trackId: track.trackId,
        trackUri: track.trackUri,
        trackName: track.trackName,
        artistName: track.artistName,
        addedAt: track.addedAt,
        removedAt: track.removedAt,
      },
    });
  }

  public async getArchivedTrack(trackId: string): Promise<ArchivedTrackItem | null> {
    const track = await this.prisma.archivedTrack.findUnique({
      where: { trackId },
    });

    if (!track) {
      return null;
    }

    return {
      trackId: track.trackId,
      trackUri: track.trackUri,
      trackName: track.trackName,
      artistName: track.artistName,
      addedAt: track.addedAt,
      removedAt: track.removedAt,
    };
  }

  public async getAllArchivedTracks(): Promise<ArchivedTrackItem[]> {
    const tracks = await this.prisma.archivedTrack.findMany();

    return tracks.map((track) => ({
      trackId: track.trackId,
      trackUri: track.trackUri,
      trackName: track.trackName,
      artistName: track.artistName,
      addedAt: track.addedAt,
      removedAt: track.removedAt,
    }));
  }

  public async getAllArchivedTrackIds(): Promise<string[]> {
    const tracks = await this.prisma.archivedTrack.findMany({
      select: { trackId: true },
    });

    return tracks.map((track) => track.trackId);
  }

  public async getArchivedTrackCount(): Promise<number> {
    return this.prisma.archivedTrack.count();
  }

  public async close(): Promise<void> {
    try {
      await this.prisma.$disconnect();
    } catch (error) {
      this.logger.warn(`Prisma disconnect failed: ${(error as Error).message}`);
    }
  }
}
