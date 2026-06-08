import type { AppStateRepository } from "../persistence/types.js";
import type { Logger, OAuthTokenStore, OAuthTokens, SpotifyTokenBinding } from "../shared/types.js";
import { t } from "../i18n/index.js";

const DEFAULT_APP_STATE_KEY = "spotify_oauth_tokens:auto_playlists";

interface StoredSpotifyTokens extends OAuthTokens, SpotifyTokenBinding {}

export class AppStateOAuthTokenStore implements OAuthTokenStore {
  constructor(
    private readonly appStateRepository: AppStateRepository,
    private readonly logger: Logger,
    private readonly binding: SpotifyTokenBinding,
    private readonly storageKey = DEFAULT_APP_STATE_KEY,
  ) {}

  public async loadTokens(): Promise<OAuthTokens | null> {
    const raw = await this.appStateRepository.getValue(this.storageKey);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<StoredSpotifyTokens>;
      if (!parsed.accessToken || !parsed.refreshToken || !parsed.expiresAtEpochMs) {
        this.logger.warn(t("spotifyTokenInvalid", this.storageKey));
        await this.appStateRepository.deleteValue(this.storageKey);
        return null;
      }

      if (!this.isBindingMatching(parsed)) {
        this.logger.info(t("spotifyTokensResetDueToConfigChange", this.storageKey));
        await this.appStateRepository.deleteValue(this.storageKey);
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
    const payload: StoredSpotifyTokens = {
      ...tokens,
      ...this.getNormalizedBinding(),
    };
    await this.appStateRepository.setValue(this.storageKey, JSON.stringify(payload));
    this.logger.info(t("spotifyTokensSaved", this.storageKey));
  }

  private isBindingMatching(parsed: Partial<StoredSpotifyTokens>): boolean {
    const binding = this.getNormalizedBinding();

    return (
      parsed.spotifyClientId === binding.spotifyClientId &&
      parsed.spotifyRedirectUri === binding.spotifyRedirectUri &&
      this.areScopeSetsEqual(parsed.oauthScopes, binding.oauthScopes)
    );
  }

  private getNormalizedBinding(): SpotifyTokenBinding {
    return {
      spotifyClientId: this.binding.spotifyClientId,
      spotifyRedirectUri: this.binding.spotifyRedirectUri,
      oauthScopes: normalizeScopes(this.binding.oauthScopes),
    };
  }

  private areScopeSetsEqual(left: string[] | undefined, right: string[]): boolean {
    if (!left) {
      return false;
    }

    const normalizedLeft = normalizeScopes(left);
    return normalizedLeft.length === right.length && normalizedLeft.every((scope, i) => scope === right[i]);
  }
}

function normalizeScopes(scopes: string[]): string[] {
  return Array.from(new Set(scopes.map((scope) => scope.trim()).filter((scope) => scope.length > 0))).sort();
}
