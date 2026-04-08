import { describe, expect, it } from "vitest";
import {
  parseHexColor,
  loadConfig,
  parsePlaylistSuffix,
  parseSavedInYearYears,
  parseSavedRecentWindows,
} from "../src/core/config.js";

describe("auto-playlists config parsers", () => {
  it("parses, deduplicates and sorts saved recent windows", () => {
    const parsed = parseSavedRecentWindows("100, 20, 20,50");
    expect(parsed).toEqual([20, 50, 100]);
  });

  it("returns empty list when saved recent windows are missing", () => {
    expect(parseSavedRecentWindows(undefined)).toEqual([]);
    expect(parseSavedRecentWindows("")).toEqual([]);
  });

  it("throws on invalid saved recent windows", () => {
    expect(() => parseSavedRecentWindows("0,20")).toThrow();
    expect(() => parseSavedRecentWindows("abc,20")).toThrow();
  });

  it("parses, deduplicates and sorts saved-in-year values", () => {
    const parsed = parseSavedInYearYears("2024, 2022, 2024,2023");
    expect(parsed).toEqual([2022, 2023, 2024]);
  });

  it("returns empty list when saved-in-year values are missing", () => {
    expect(parseSavedInYearYears(undefined)).toEqual([]);
    expect(parseSavedInYearYears("")).toEqual([]);
  });

  it("throws on invalid saved-in-year values", () => {
    expect(() => parseSavedInYearYears("2005")).toThrow();
    expect(() => parseSavedInYearYears("abc,2024")).toThrow();
  });

  it("normalizes valid hex colors", () => {
    expect(parseHexColor("#000")).toBe("#000000");
    expect(parseHexColor("1a2b3c")).toBe("#1A2B3C");
  });

  it("throws on invalid hex colors", () => {
    expect(() => parseHexColor("zzz")).toThrow();
    expect(() => parseHexColor("#12345")).toThrow();
  });

  it("uses default suffix when suffix is missing or empty", () => {
    expect(parsePlaylistSuffix(undefined)).toBe("[AUTO]");
    expect(parsePlaylistSuffix("")).toBe("[AUTO]");
    expect(parsePlaylistSuffix("   ")).toBe("[AUTO]");
  });

  it("preserves explicit suffix", () => {
    expect(parsePlaylistSuffix("[SYNC]")).toBe("[SYNC]");
  });

  it("uses dedicated full sync interval when it is configured", () => {
    process.env.SPOTIFY_CLIENT_ID = "test-client-id";
    process.env.SPOTIFY_CLIENT_SECRET = "test-client-secret";
    process.env.SPOTIFY_REDIRECT_URI = "http://127.0.0.1:3000/callback";
    process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/spotify_helper_test";
    process.env.AUTO_PLAYLISTS_FULL_SYNC_INTERVAL_MS = "7200000";

    expect(loadConfig().autoPlaylistsFullSyncIntervalMs).toBe(7200000);
  });

  it("prefers frequent sync interval env name", () => {
    process.env.SPOTIFY_CLIENT_ID = "test-client-id";
    process.env.SPOTIFY_CLIENT_SECRET = "test-client-secret";
    process.env.SPOTIFY_REDIRECT_URI = "http://127.0.0.1:3000/callback";
    process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/spotify_helper_test";
    process.env.AUTO_PLAYLISTS_FREQUENT_SYNC_INTERVAL_MS = "45000";

    expect(loadConfig().autoPlaylistsFrequentSyncIntervalMs).toBe(45000);
  });

  it("uses default frequent and full sync intervals when env values are missing", () => {
    process.env.SPOTIFY_CLIENT_ID = "test-client-id";
    process.env.SPOTIFY_CLIENT_SECRET = "test-client-secret";
    process.env.SPOTIFY_REDIRECT_URI = "http://127.0.0.1:3000/callback";
    process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/spotify_helper_test";
    delete process.env.AUTO_PLAYLISTS_FREQUENT_SYNC_INTERVAL_MS;
    delete process.env.AUTO_PLAYLISTS_FULL_SYNC_INTERVAL_MS;

    const config = loadConfig();

    expect(config.autoPlaylistsFrequentSyncIntervalMs).toBe(600000);
    expect(config.autoPlaylistsFullSyncIntervalMs).toBe(10800000);
  });
});
