import type { AppConfig } from "../core/config.js";
import type { Logger } from "../shared/types.js";
export declare class AuthManager {
    private readonly cfg;
    private readonly log;
    private readonly fetchImpl;
    private tokens;
    constructor(cfg: AppConfig, log: Logger, fetchImpl?: typeof fetch);
    initialize(): Promise<void>;
    getAccessToken(): Promise<string>;
    handleUnauthorized(): Promise<void>;
    private authorizeInteractive;
    private waitForAuthCode;
    private exchangeCodeForToken;
    private refreshAccessToken;
    private readTokensFromDisk;
    private writeTokensToDisk;
}
//# sourceMappingURL=auth-manager.d.ts.map