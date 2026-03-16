import fs from "node:fs";
import path from "node:path";
import { Inject, Injectable } from "@nestjs/common";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PlayedTrackSource, PrismaClient } from "@prisma/client";
import { APP_LOGGER, PRISMA_CLIENT } from "../core/nest.tokens.js";
import type { HistoryEntry, Logger, RecentlyPlayedItem } from "../shared/types.js";

export interface HistoryRepository {
  addLiveTrack(input: {
    trackUri: string;
    playedAt: Date;
    trackName?: string | null;
    artistName?: string | null;
  }): Promise<boolean>;
  addBackfillItems(items: RecentlyPlayedItem[]): Promise<number>;
  getRecentEntries(limit: number): Promise<HistoryEntry[]>;
  close(): Promise<void>;
}

export function createPrismaClient(databaseUrl: string): PrismaClient {
  ensureSqliteDirectoryExists(databaseUrl);
  const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
  return new PrismaClient({ adapter });
}

@Injectable()
export class PrismaHistoryRepository implements HistoryRepository {
  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
    @Inject(APP_LOGGER) private readonly logger: Logger,
  ) {}

  public async addLiveTrack(input: {
    trackUri: string;
    playedAt: Date;
    trackName?: string | null;
    artistName?: string | null;
  }): Promise<boolean> {
    const now = new Date();
    try {
      await this.prisma.playedTrack.create({
        data: {
          trackUri: input.trackUri,
          trackName: input.trackName ?? null,
          artistName: input.artistName ?? null,
          playedAt: input.playedAt,
          source: PlayedTrackSource.LIVE,
          observedAt: now,
        },
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      await this.prisma.playedTrack.updateMany({
        where: {
          trackUri: input.trackUri,
          playedAt: input.playedAt,
        },
        data: {
          trackName: input.trackName ?? null,
          artistName: input.artistName ?? null,
          source: PlayedTrackSource.LIVE,
          observedAt: now,
        },
      });

      return false;
    }

    return true;
  }

  public async addBackfillItems(items: RecentlyPlayedItem[]): Promise<number> {
    if (items.length === 0) {
      return 0;
    }

    const observedAt = new Date();
    const sorted = [...items].sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());

    let inserted = 0;

    for (const item of sorted) {
      try {
        await this.prisma.playedTrack.create({
          data: {
            trackUri: item.trackUri,
            trackName: item.trackName ?? null,
            artistName: item.artistName ?? null,
            playedAt: item.playedAt,
            source: PlayedTrackSource.BACKFILL,
            observedAt,
          },
        });
        inserted += 1;
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          throw error;
        }
      }
    }

    return inserted;
  }

  public async getRecentEntries(limit: number): Promise<HistoryEntry[]> {
    const events = await this.prisma.playedTrack.findMany({
      orderBy: { playedAt: "desc" },
      take: Math.max(1, limit),
    });

    return events.map((event) => ({
      trackUri: event.trackUri,
      trackName: event.trackName,
      artistName: event.artistName,
      playedAt: event.playedAt,
      source: event.source === PlayedTrackSource.BACKFILL ? "backfill" : "live",
    }));
  }

  public async close(): Promise<void> {
    try {
      await this.prisma.$disconnect();
    } catch (error) {
      this.logger.warn(`Prisma disconnect failed: ${(error as Error).message}`);
    }
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
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

export function estimateLivePlayedAt(input: {
  fetchedAtEpochMs: number;
  progressMs: number | null;
}): Date {
  if (typeof input.progressMs !== "number" || Number.isNaN(input.progressMs)) {
    return new Date(input.fetchedAtEpochMs);
  }

  return new Date(Math.max(0, input.fetchedAtEpochMs - Math.max(0, input.progressMs)));
}
