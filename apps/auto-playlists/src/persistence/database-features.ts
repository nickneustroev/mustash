import type { PrismaClient } from "@prisma/client";
import type { AppConfig } from "../core/config.js";
import type { Logger } from "../shared/types.js";
import { t } from "../i18n/index.js";

export class DatabaseFeatures {
  private persistenceEnabled = false;
  private checked = false;

  constructor(
    private readonly cfg: AppConfig,
    private readonly prisma: PrismaClient | null,
    private readonly logger: Logger,
  ) {}

  public async initialize(): Promise<void> {
    if (this.checked) {
      return;
    }
    this.checked = true;

    if (this.cfg.databaseUrl.trim().length === 0) {
      this.persistenceEnabled = false;
      this.logger.warn(t("databaseUrlEmpty"));
      return;
    }

    if (!this.prisma) {
      this.persistenceEnabled = false;
      this.logger.warn(t("databaseClientNotCreated"));
      return;
    }

    try {
      await this.prisma.$queryRawUnsafe("SELECT 1");
      this.persistenceEnabled = true;
      this.logger.info(t("databaseConnected"));
    } catch (error) {
      this.persistenceEnabled = false;
      this.logger.warn(t("databaseConnectionFailed", (error as Error).message));
    }
  }

  public isPersistenceEnabled(): boolean {
    return this.persistenceEnabled;
  }
}
