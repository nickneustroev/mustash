import { describe, expect, it } from "vitest";
import { decideTrackEvent, type TrackDecisionState } from "../src/track-decision.js";
import type { PlaybackSnapshot } from "../src/types.js";

function trackSnapshot(trackId: string, isPlaying = true): PlaybackSnapshot {
  return {
    isPlaying,
    itemType: "track",
    trackId,
    trackUri: `spotify:track:${trackId}`,
    trackName: "Song",
    artists: ["Artist"],
    progressMs: 1000,
    fetchedAtEpochMs: 1,
  };
}

describe("decideTrackEvent", () => {
  it("does not emit on first poll when PRINT_ON_START=false", () => {
    const state: TrackDecisionState = { initialized: false, lastReportedTrackId: null };
    const result = decideTrackEvent(state, trackSnapshot("t1"), false);

    expect(result.shouldEmit).toBe(false);
    expect(result.nextState).toEqual({ initialized: true, lastReportedTrackId: "t1" });
  });

  it("emits on first poll when PRINT_ON_START=true and track is playing", () => {
    const state: TrackDecisionState = { initialized: false, lastReportedTrackId: null };
    const result = decideTrackEvent(state, trackSnapshot("t1"), true);

    expect(result.shouldEmit).toBe(true);
    expect(result.nextState).toEqual({ initialized: true, lastReportedTrackId: "t1" });
  });

  it("does not emit duplicate for same track", () => {
    const state: TrackDecisionState = { initialized: true, lastReportedTrackId: "t1" };
    const result = decideTrackEvent(state, trackSnapshot("t1"), false);

    expect(result.shouldEmit).toBe(false);
    expect(result.nextState).toEqual(state);
  });

  it("emits when track id changed", () => {
    const state: TrackDecisionState = { initialized: true, lastReportedTrackId: "t1" };
    const result = decideTrackEvent(state, trackSnapshot("t2"), false);

    expect(result.shouldEmit).toBe(true);
    expect(result.nextState.lastReportedTrackId).toBe("t2");
  });

  it("does not emit while paused", () => {
    const state: TrackDecisionState = { initialized: true, lastReportedTrackId: "t1" };
    const result = decideTrackEvent(state, trackSnapshot("t2", false), false);

    expect(result.shouldEmit).toBe(false);
    expect(result.nextState).toEqual(state);
  });
});
