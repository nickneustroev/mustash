import fs from "node:fs";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PlayedTrackSource, PrismaClient } from "@prisma/client";
import type { HistoryEntry, Logger, RecentlyPlayedItem } from "./types.js";

export interface HistoryRepository {
  addLiveTrack(input: {
    trackUri: string;
    playedAtEpochMs: number;
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

export class PrismaHistoryRepository implements HistoryRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger,
  ) {}

  public async addLiveTrack(input: {
    trackUri: string;
    playedAtEpochMs: number;
    trackName?: string | null;
    artistName?: string | null;
  }): Promise<boolean> {
    const now = Date.now();
    try {
      await this.prisma.playedTrack.create({
        data: {
          trackUri: input.trackUri,
          trackName: input.trackName ?? null,
          artistName: input.artistName ?? null,
          playedAtEpochMs: BigInt(input.playedAtEpochMs),
          source: PlayedTrackSource.LIVE,
          observedAtEpochMs: BigInt(now),
        },
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      await this.prisma.playedTrack.updateMany({
        where: {
          trackUri: input.trackUri,
          playedAtEpochMs: BigInt(input.playedAtEpochMs),
        },
        data: {
          trackName: input.trackName ?? null,
          artistName: input.artistName ?? null,
          source: PlayedTrackSource.LIVE,
          observedAtEpochMs: BigInt(now),
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

    const observedAtEpochMs = BigInt(Date.now());
    const sorted = [...items].sort((a, b) => a.playedAtEpochMs - b.playedAtEpochMs);

    let inserted = 0;

    for (const item of sorted) {
      try {
        await this.prisma.playedTrack.create({
          data: {
            trackUri: item.trackUri,
            trackName: item.trackName ?? null,
            artistName: item.artistName ?? null,
            playedAtEpochMs: BigInt(item.playedAtEpochMs),
            source: PlayedTrackSource.BACKFILL,
            observedAtEpochMs,
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
      orderBy: { playedAtEpochMs: "desc" },
      take: Math.max(1, limit),
    });

    return events.map((event) => ({
      trackUri: event.trackUri,
      trackName: event.trackName,
      artistName: event.artistName,
      playedAtEpochMs: Number(event.playedAtEpochMs),
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

export function estimateLivePlayedAtEpochMs(input: {
  fetchedAtEpochMs: number;
  progressMs: number | null;
}): number {
  if (typeof input.progressMs !== "number" || Number.isNaN(input.progressMs)) {
    return input.fetchedAtEpochMs;
  }

  return Math.max(0, input.fetchedAtEpochMs - Math.max(0, input.progressMs));
}
