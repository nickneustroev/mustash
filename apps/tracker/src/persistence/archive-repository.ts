import fs from "node:fs";
import path from "node:path";
import { Inject, Injectable } from "@nestjs/common";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { APP_LOGGER, PRISMA_CLIENT } from "../core/nest.tokens.js";
import type { Logger, ArchivedTrackItem } from "../shared/types.js";

export interface ArchiveRepository {
  upsertArchivedTrack(track: ArchivedTrackItem): Promise<void>;
  getArchivedTrack(trackId: string): Promise<ArchivedTrackItem | null>;
  getAllArchivedTracks(): Promise<ArchivedTrackItem[]>;
  getAllArchivedTrackIds(): Promise<string[]>;
  getArchivedTrackCount(): Promise<number>;
  close(): Promise<void>;
}

@Injectable()
export class PrismaArchiveRepository implements ArchiveRepository {
  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
    @Inject(APP_LOGGER) private readonly logger: Logger,
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

    return tracks.map((t) => t.trackId);
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

export function createPrismaClient(databaseUrl: string): PrismaClient {
  ensureSqliteDirectoryExists(databaseUrl);
  const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
  return new PrismaClient({ adapter });
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
