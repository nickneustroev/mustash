import fs from "node:fs";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import type { Logger, SavedTrackItem } from "./types.js";

export interface SavedTrackRepository {
  upsertSavedTrack(track: SavedTrackItem): Promise<void>;
  upsertSavedTracks(tracks: SavedTrackItem[]): Promise<number>;
  deleteSavedTrack(trackId: string): Promise<void>;
  deleteSavedTracks(trackIds: string[]): Promise<number>;
  getAllSavedTrackIds(): Promise<string[]>;
  getAllSavedTracks(): Promise<SavedTrackItem[]>;
  getSavedTrackCount(): Promise<number>;
  close(): Promise<void>;
}

export function createPrismaClient(databaseUrl: string): PrismaClient {
  ensureSqliteDirectoryExists(databaseUrl);
  const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
  return new PrismaClient({ adapter });
}

export class PrismaSavedTrackRepository implements SavedTrackRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger,
  ) {}

  public async upsertSavedTrack(track: SavedTrackItem): Promise<void> {
    await this.prisma.savedTrack.upsert({
      where: { trackId: track.trackId },
      update: {
        trackUri: track.trackUri,
        trackName: track.trackName,
        artistName: track.artistName,
        addedAt: track.addedAt,
      },
      create: {
        trackId: track.trackId,
        trackUri: track.trackUri,
        trackName: track.trackName,
        artistName: track.artistName,
        addedAt: track.addedAt,
      },
    });
  }

  public async upsertSavedTracks(tracks: SavedTrackItem[]): Promise<number> {
    if (tracks.length === 0) {
      return 0;
    }

    let inserted = 0;
    for (const track of tracks) {
      try {
        await this.upsertSavedTrack(track);
        inserted += 1;
      } catch (error) {
        this.logger.warn(`Failed to upsert saved track ${track.trackId}: ${(error as Error).message}`);
      }
    }

    return inserted;
  }

  public async deleteSavedTrack(trackId: string): Promise<void> {
    await this.prisma.savedTrack.delete({
      where: { trackId },
    });
  }

  public async deleteSavedTracks(trackIds: string[]): Promise<number> {
    if (trackIds.length === 0) {
      return 0;
    }

    let deleted = 0;
    for (const trackId of trackIds) {
      try {
        await this.deleteSavedTrack(trackId);
        deleted += 1;
      } catch (error) {
        if (!isNotFoundError(error)) {
          this.logger.warn(`Failed to delete saved track ${trackId}: ${(error as Error).message}`);
        }
      }
    }

    return deleted;
  }

  public async getAllSavedTrackIds(): Promise<string[]> {
    const tracks = await this.prisma.savedTrack.findMany({
      select: { trackId: true },
    });

    return tracks.map((t) => t.trackId);
  }

  public async getAllSavedTracks(): Promise<SavedTrackItem[]> {
    const tracks = await this.prisma.savedTrack.findMany();

    return tracks.map((track) => ({
      trackId: track.trackId,
      trackUri: track.trackUri,
      trackName: track.trackName,
      artistName: track.artistName,
      addedAt: track.addedAt,
    }));
  }

  public async getSavedTrackCount(): Promise<number> {
    return this.prisma.savedTrack.count();
  }

  public async close(): Promise<void> {
    try {
      await this.prisma.$disconnect();
    } catch (error) {
      this.logger.warn(`Prisma disconnect failed: ${(error as Error).message}`);
    }
  }
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2025"
  );
}

function ensureSqliteDirectoryExists(databaseUrl: string): void {
  if (!databaseUrl.startsWith("file:")) {
    return;
  }

  const raw = databaseUrl.slice("file:".length);
  const dbPathWithoutQuery = raw.split("?")[0] ?? "";
  if (!dbPathWithoutQuery) {
    return;
  }

  const resolvedDbPath = resolveDatabasePath(dbPathWithoutQuery);
  const dir = path.dirname(resolvedDbPath);
  fs.mkdirSync(dir, { recursive: true });
}

function resolveDatabasePath(dbPath: string): string {
  if (dbPath.startsWith("./") || dbPath.startsWith("../")) {
    return path.resolve(process.cwd(), dbPath);
  }

  if (path.isAbsolute(dbPath)) {
    return path.resolve(dbPath);
  }

  return path.resolve(process.cwd(), dbPath);
}
