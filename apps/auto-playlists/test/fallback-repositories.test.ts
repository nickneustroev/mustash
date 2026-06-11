import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileAppStateRepository } from "../src/persistence/fallback-repositories.js";

let tempDir: string | null = null;

async function createTempFilePath(): Promise<string> {
  tempDir = await mkdtemp(join(tmpdir(), "mustash-app-state-"));
  return join(tempDir, "app-state.json");
}

describe("FileAppStateRepository", () => {
  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it("persists values across repository instances", async () => {
    const filePath = await createTempFilePath();
    const first = new FileAppStateRepository(filePath);

    await first.setValue("spotify_oauth_tokens:auto_playlists", "token-payload");

    const second = new FileAppStateRepository(filePath);
    await expect(second.getValue("spotify_oauth_tokens:auto_playlists")).resolves.toBe("token-payload");

    const raw = await readFile(filePath, "utf8");
    expect(JSON.parse(raw)).toEqual({
      "spotify_oauth_tokens:auto_playlists": "token-payload",
    });
  });

  it("treats invalid JSON as empty state", async () => {
    const filePath = await createTempFilePath();
    await writeFile(filePath, "{", "utf8");

    const repository = new FileAppStateRepository(filePath);

    await expect(repository.getValue("missing")).resolves.toBeNull();
  });

  it("deletes values from the state file", async () => {
    const filePath = await createTempFilePath();
    const repository = new FileAppStateRepository(filePath);

    await repository.setValue("key", "value");
    await repository.deleteValue("key");

    await expect(repository.getValue("key")).resolves.toBeNull();
  });

  it("preserves concurrent writes for different keys", async () => {
    const filePath = await createTempFilePath();
    const repository = new FileAppStateRepository(filePath);

    await Promise.all([
      repository.setValue("auto_playlists:playlist_id:saved-recent:50", "playlist-50"),
      repository.setValue("auto_playlists:playlist_id:saved-recent:200", "playlist-200"),
      repository.setValue("spotify_oauth_tokens:auto_playlists", "token-payload"),
    ]);

    const raw = await readFile(filePath, "utf8");
    expect(JSON.parse(raw)).toEqual({
      "auto_playlists:playlist_id:saved-recent:50": "playlist-50",
      "auto_playlists:playlist_id:saved-recent:200": "playlist-200",
      "spotify_oauth_tokens:auto_playlists": "token-payload",
    });
  });
});
