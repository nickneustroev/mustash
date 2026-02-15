import fs from "node:fs/promises";
import type { Logger, HistoryEntry, HistorySource } from "./types.js";

interface HistoryStateFile {
  items: HistoryEntry[];
  updatedAtEpochMs: number;
}

export class HistoryStore {
  private items: HistoryEntry[] = [];
  private saveQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly statePath: string,
    private readonly maxItems: number,
    private readonly logger: Logger,
  ) {}

  public async load(): Promise<void> {
    try {
      const raw = await fs.readFile(this.statePath, "utf-8");
      const parsed = JSON.parse(raw) as Partial<HistoryStateFile>;
      if (!Array.isArray(parsed.items)) {
        this.logger.warn("History state is invalid. Starting with empty history.");
        this.items = [];
        return;
      }
      const normalized = parsed.items
        .map((item) => normalizeHistoryEntry(item))
        .filter((item): item is HistoryEntry => item !== null);

      this.items = normalized
        .sort((a, b) => b.playedAtEpochMs - a.playedAtEpochMs)
        .slice(0, this.maxItems);
      this.logger.info(`History loaded (${this.items.length} items).`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        this.logger.warn("History state cannot be read. Starting with empty history.");
      }
      this.items = [];
    }
  }

  public async save(): Promise<void> {
    this.saveQueue = this.saveQueue.then(async () => {
      const state: HistoryStateFile = {
        items: this.items,
        updatedAtEpochMs: Date.now(),
      };
      await fs.writeFile(this.statePath, `${JSON.stringify(state, null, 2)}\n`, "utf-8");
    });

    await this.saveQueue;
  }

  public addLiveTrack(trackUri: string): boolean {
    return this.addEntry({
      trackUri,
      playedAtEpochMs: Date.now(),
      source: "live",
    });
  }

  public addBackfillItems(items: Array<{ trackUri: string; playedAtEpochMs: number }>): boolean {
    if (items.length === 0) {
      return false;
    }

    const seenKeys = new Set(this.items.map((item) => historyKey(item.trackUri, item.playedAtEpochMs)));
    const sorted = [...items].sort((a, b) => a.playedAtEpochMs - b.playedAtEpochMs);
    let changed = false;

    for (const item of sorted) {
      const key = historyKey(item.trackUri, item.playedAtEpochMs);
      if (seenKeys.has(key)) {
        continue;
      }
      seenKeys.add(key);
      this.items.unshift({
        trackUri: item.trackUri,
        playedAtEpochMs: item.playedAtEpochMs,
        source: "backfill",
      });
      changed = true;
    }

    if (changed) {
      this.items = this.items.slice(0, this.maxItems);
    }

    return changed;
  }

  public getTrackUris(): string[] {
    return this.items.map((item) => item.trackUri);
  }

  public getEntries(): HistoryEntry[] {
    return [...this.items];
  }

  private addEntry(entry: HistoryEntry): boolean {
    this.items.unshift(entry);
    this.items = this.items.slice(0, this.maxItems);
    return true;
  }
}

function normalizeHistoryEntry(item: unknown): HistoryEntry | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const raw = item as Partial<HistoryEntry>;
  if (!raw.trackUri || typeof raw.trackUri !== "string") {
    return null;
  }
  if (typeof raw.playedAtEpochMs !== "number" || Number.isNaN(raw.playedAtEpochMs)) {
    return null;
  }

  const source: HistorySource = raw.source === "backfill" ? "backfill" : "live";

  return {
    trackUri: raw.trackUri,
    playedAtEpochMs: raw.playedAtEpochMs,
    source,
  };
}

function historyKey(trackUri: string, playedAtEpochMs: number): string {
  return `${trackUri}|${playedAtEpochMs}`;
}
