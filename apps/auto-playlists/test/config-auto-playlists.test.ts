import { describe, expect, it } from "vitest";
import { parseSavedInYearYears, parseSavedRecentWindows } from "../src/core/config.js";

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
});
