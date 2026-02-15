import { describe, expect, it } from "vitest";
import { parseLikedRecentWindows } from "../src/config.js";

describe("parseLikedRecentWindows", () => {
  it("parses, deduplicates and sorts windows", () => {
    const parsed = parseLikedRecentWindows("100, 20, 20,50");
    expect(parsed).toEqual([20, 50, 100]);
  });

  it("throws on invalid values", () => {
    expect(() => parseLikedRecentWindows("0,20")).toThrow();
    expect(() => parseLikedRecentWindows("abc,20")).toThrow();
    expect(() => parseLikedRecentWindows("")).toThrow();
  });
});
