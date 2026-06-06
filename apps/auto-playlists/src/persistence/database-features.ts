import type { PrismaClient } from "@prisma/client";
import type { AppConfig } from "../core/config.js";
import type { Logger } from "../shared/types.js";

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
      this.logger.warn(
        "База данных не указана: DATABASE_URL пустой. Приложение будет работать без функций, которые используют БД: сохранение прослушанных треков и сохранение удаленных треков отключены.",
      );
      return;
    }

    if (!this.prisma) {
      this.persistenceEnabled = false;
      this.logger.warn(
        "Обнаружено подключение к БД, но клиент БД не создан. Приложение будет работать без функций, которые используют БД.",
      );
      return;
    }

    try {
      await this.prisma.$queryRawUnsafe("SELECT 1");
      this.persistenceEnabled = true;
      this.logger.info(
        "Обнаружено подключение к БД, и оно проверено. Приложение будет использовать функции, которые сохраняют данные в БД.",
      );
    } catch (error) {
      this.persistenceEnabled = false;
      this.logger.warn(
        `Обнаружено подключение к БД, но не удается подключиться: ${(error as Error).message}. Приложение будет работать без функций, которые используют БД.`,
      );
    }
  }

  public isPersistenceEnabled(): boolean {
    return this.persistenceEnabled;
  }
}
