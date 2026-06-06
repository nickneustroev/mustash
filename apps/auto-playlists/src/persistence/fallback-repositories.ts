import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { AppStateRepository, ArchiveRepository, ArchivedTrackItem, HistoryEntry, HistoryRepository } from "./types.js";

type AppStateFilePayload = Record<string, string>;

export class FileAppStateRepository implements AppStateRepository {
  constructor(private readonly filePath = resolve("temp", "app-state.json")) {}

  public async getValue(key: string): Promise<string | null> {
    const values = await this.readValues();
    return values[key] ?? null;
  }

  public async setValue(key: string, value: string): Promise<void> {
    const values = await this.readValues();
    values[key] = value;
    await this.writeValues(values);
  }

  public async deleteValue(key: string): Promise<void> {
    const values = await this.readValues();
    delete values[key];
    await this.writeValues(values);
  }

  public async close(): Promise<void> {}

  private async readValues(): Promise<AppStateFilePayload> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      if (!isStringRecord(parsed)) {
        return {};
      }
      return parsed;
    } catch (error) {
      if (isNotFoundError(error) || error instanceof SyntaxError) {
        return {};
      }
      throw error;
    }
  }

  private async writeValues(values: AppStateFilePayload): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(values, null, 2)}\n`, "utf8");
    await rename(tempPath, this.filePath);
  }
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

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((item) => typeof item === "string")
  );
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}
