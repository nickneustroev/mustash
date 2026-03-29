import type { Logger, PlaybackSnapshot } from "../shared/types.js";

export class ConsoleNotifier {
  constructor(private readonly log: Logger) {}

  public notifyNewTrack(snapshot: PlaybackSnapshot): void {
    const artists = snapshot.artists.length > 0 ? snapshot.artists.join(", ") : "Unknown Artist";
    const trackName = snapshot.trackName ?? "Unknown Track";
    this.log.info(`TRACK ${artists} - ${trackName}`);
  }
}
