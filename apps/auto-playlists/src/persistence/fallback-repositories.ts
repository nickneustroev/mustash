import type { AppStateRepository, ArchiveRepository, ArchivedTrackItem, HistoryEntry, HistoryRepository } from "./types.js";

export class MemoryAppStateRepository implements AppStateRepository {
  private readonly values = new Map<string, string>();

  public async getValue(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  public async setValue(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  public async deleteValue(key: string): Promise<void> {
    this.values.delete(key);
  }

  public async close(): Promise<void> {}
}

export class ResilientAppStateRepository implements AppStateRepository {
  constructor(
    private readonly primary: AppStateRepository,
    private readonly fallback: AppStateRepository,
  ) {}

  public async getValue(key: string): Promise<string | null> {
    try {
      return await this.primary.getValue(key);
    } catch {
      return this.fallback.getValue(key);
    }
  }

  public async setValue(key: string, value: string): Promise<void> {
    try {
      await this.primary.setValue(key, value);
    } catch {
      await this.fallback.setValue(key, value);
    }
  }

  public async deleteValue(key: string): Promise<void> {
    try {
      await this.primary.deleteValue(key);
    } catch {
      await this.fallback.deleteValue(key);
    }
  }

  public async close(): Promise<void> {
    await Promise.all([this.primary.close(), this.fallback.close()]);
  }
}

export class DisabledHistoryRepository implements HistoryRepository {
  public async addLiveTrack(): Promise<boolean> {
    return false;
  }

  public async addBackfillItems(): Promise<number> {
    return 0;
  }

  public async getRecentEntries(): Promise<HistoryEntry[]> {
    return [];
  }

  public async close(): Promise<void> {}
}

export class DisabledArchiveRepository implements ArchiveRepository {
  public async upsertArchivedTrack(_track: ArchivedTrackItem): Promise<void> {}

  public async getArchivedTrack(): Promise<ArchivedTrackItem | null> {
    return null;
  }

  public async getAllArchivedTracks(): Promise<ArchivedTrackItem[]> {
    return [];
  }

  public async getAllArchivedTrackIds(): Promise<string[]> {
    return [];
  }

  public async getArchivedTrackCount(): Promise<number> {
    return 0;
  }

  public async close(): Promise<void> {}
}
