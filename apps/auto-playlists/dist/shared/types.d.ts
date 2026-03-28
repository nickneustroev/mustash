export interface OAuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresAtEpochMs: number;
}
export interface Logger {
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
}
//# sourceMappingURL=types.d.ts.map