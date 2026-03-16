import { describe, expect, it } from "vitest";
import { calculateBackoffDelayMs } from "../src/track-watcher.js";

describe("calculateBackoffDelayMs", () => {
  it("uses retry-after when greater than poll interval", () => {
    const delay = calculateBackoffDelayMs(2500, 5, () => 0);
    expect(delay).toBe(5100);
  });

  it("never returns lower than poll interval", () => {
    const delay = calculateBackoffDelayMs(2500, 1, () => 0);
    expect(delay).toBe(2500);
  });
});
