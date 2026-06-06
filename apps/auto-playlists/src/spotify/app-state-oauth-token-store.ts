import type { AppStateRepository } from "../persistence/types.js";
import type { Logger, OAuthTokenStore, OAuthTokens } from "../shared/types.js";
import { t } from "../i18n/index.js";

const DEFAULT_APP_STATE_KEY = "spotify_oauth_tokens:auto_playlists";

export class AppStateOAuthTokenStore implements OAuthTokenStore {
  constructor(
    private readonly appStateRepository: AppStateRepository,
    private readonly logger: Logger,
    private readonly storageKey = DEFAULT_APP_STATE_KEY,
  ) {}

  public async loadTokens(): Promise<OAuthTokens | null> {
    const raw = await this.appStateRepository.getValue(this.storageKey);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<OAuthTokens>;
      if (!parsed.accessToken || !parsed.refreshToken || !parsed.expiresAtEpochMs) {
        this.logger.warn(t("spotifyTokenInvalid", this.storageKey));
        return null;
      }

      return {
        accessToken: parsed.accessToken,
        refreshToken: parsed.refreshToken,
        expiresAtEpochMs: parsed.expiresAtEpochMs,
      };
    } catch (error) {
      this.logger.warn(
        t("spotifyTokenParseFailed", this.storageKey, (error as Error).message),
      );
      return null;
    }
  }

  public async saveTokens(tokens: OAuthTokens): Promise<void> {
    await this.appStateRepository.setValue(this.storageKey, JSON.stringify(tokens));
    this.logger.info(t("spotifyTokensSaved", this.storageKey));
  }
}
