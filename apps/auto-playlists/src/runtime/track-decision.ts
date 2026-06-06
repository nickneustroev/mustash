import type { PlaybackSnapshot } from "../shared/types.js";

export interface TrackDecisionState {
  initialized: boolean;
  lastReportedTrackId: string | null;
}

export interface TrackDecisionResult {
  shouldEmit: boolean;
  nextState: TrackDecisionState;
}

export function decideTrackEvent(
  state: TrackDecisionState,
  snapshot: PlaybackSnapshot | null,
): TrackDecisionResult {
  if (!snapshot) {
    return { shouldEmit: false, nextState: state };
  }

  if (snapshot.itemType !== "track" || !snapshot.trackId) {
    return {
      shouldEmit: false,
      nextState: {
        ...state,
        initialized: true,
      },
    };
  }

  if (!state.initialized) {
    return {
      shouldEmit: snapshot.isPlaying,
      nextState: {
        initialized: true,
        lastReportedTrackId: snapshot.isPlaying ? snapshot.trackId : null,
      },
    };
  }

  if (!snapshot.isPlaying) {
    return { shouldEmit: false, nextState: state };
  }

  const hasChanged = snapshot.trackId !== state.lastReportedTrackId;
  if (!hasChanged) {
    return { shouldEmit: false, nextState: state };
  }

  return {
    shouldEmit: true,
    nextState: {
      ...state,
      lastReportedTrackId: snapshot.trackId,
    },
  };
}
