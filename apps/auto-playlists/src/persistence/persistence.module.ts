import { Module } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import { type AppConfig } from "../core/config.js";
import { CoreModule } from "../core/core.module.js";
import {
  APP_STATE_REPOSITORY,
  APP_CONFIG,
  APP_LOGGER,
  ARCHIVE_REPOSITORY,
  DATABASE_FEATURES,
  HISTORY_REPOSITORY,
  PRISMA_CLIENT,
} from "../core/nest.tokens.js";
import type { Logger } from "../shared/types.js";
import { PrismaAppStateRepository } from "./app-state-repository.js";
import { PrismaArchiveRepository } from "./archive-repository.js";
import { DatabaseFeatures } from "./database-features.js";
import {
  DisabledArchiveRepository,
  DisabledHistoryRepository,
  MemoryAppStateRepository,
  ResilientAppStateRepository,
} from "./fallback-repositories.js";
import { PrismaHistoryRepository } from "./history-repository.js";
import { createPrismaClient } from "./prisma-client.js";
import type { AppStateRepository, ArchiveRepository, HistoryRepository } from "./types.js";

@Module({
  imports: [CoreModule],
  providers: [
    {
      provide: PRISMA_CLIENT,
      inject: [APP_CONFIG],
      useFactory: (cfg: AppConfig): PrismaClient | null =>
        cfg.databaseUrl.trim().length > 0 ? createPrismaClient(cfg.databaseUrl) : null,
    },
    {
      provide: DATABASE_FEATURES,
      inject: [APP_CONFIG, PRISMA_CLIENT, APP_LOGGER],
      useFactory: (cfg: AppConfig, prisma: PrismaClient | null, log: Logger): DatabaseFeatures =>
        new DatabaseFeatures(cfg, prisma, log),
    },
    {
      provide: APP_STATE_REPOSITORY,
      inject: [PRISMA_CLIENT, APP_LOGGER],
      useFactory: (prisma: PrismaClient | null, log: Logger): AppStateRepository => {
        const fallback = new MemoryAppStateRepository();
        return prisma
          ? new ResilientAppStateRepository(new PrismaAppStateRepository(prisma, log), fallback)
          : fallback;
      },
    },
    {
      provide: ARCHIVE_REPOSITORY,
      inject: [PRISMA_CLIENT, APP_LOGGER],
      useFactory: (prisma: PrismaClient | null, log: Logger): ArchiveRepository =>
        prisma ? new PrismaArchiveRepository(prisma, log) : new DisabledArchiveRepository(),
    },
    {
      provide: HISTORY_REPOSITORY,
      inject: [PRISMA_CLIENT, APP_LOGGER],
      useFactory: (prisma: PrismaClient | null, log: Logger): HistoryRepository =>
        prisma ? new PrismaHistoryRepository(prisma, log) : new DisabledHistoryRepository(),
    },
  ],
  exports: [PRISMA_CLIENT, DATABASE_FEATURES, APP_STATE_REPOSITORY, ARCHIVE_REPOSITORY, HISTORY_REPOSITORY],
})
export class PersistenceModule {}
