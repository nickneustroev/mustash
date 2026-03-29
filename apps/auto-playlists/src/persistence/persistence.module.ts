import { Module } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import { type AppConfig } from "../core/config.js";
import { CoreModule } from "../core/core.module.js";
import {
  APP_STATE_REPOSITORY,
  APP_CONFIG,
  APP_LOGGER,
  ARCHIVE_REPOSITORY,
  HISTORY_REPOSITORY,
  PRISMA_CLIENT,
} from "../core/nest.tokens.js";
import type { Logger } from "../shared/types.js";
import { PrismaAppStateRepository } from "./app-state-repository.js";
import { PrismaArchiveRepository } from "./archive-repository.js";
import { PrismaHistoryRepository } from "./history-repository.js";
import { createPrismaClient } from "./prisma-client.js";

@Module({
  imports: [CoreModule],
  providers: [
    {
      provide: PRISMA_CLIENT,
      inject: [APP_CONFIG],
      useFactory: (cfg: AppConfig): PrismaClient => createPrismaClient(cfg.databaseUrl),
    },
    {
      provide: APP_STATE_REPOSITORY,
      inject: [PRISMA_CLIENT, APP_LOGGER],
      useFactory: (prisma: PrismaClient, log: Logger) => new PrismaAppStateRepository(prisma, log),
    },
    {
      provide: ARCHIVE_REPOSITORY,
      inject: [PRISMA_CLIENT, APP_LOGGER],
      useFactory: (prisma: PrismaClient, log: Logger) => new PrismaArchiveRepository(prisma, log),
    },
    {
      provide: HISTORY_REPOSITORY,
      inject: [PRISMA_CLIENT, APP_LOGGER],
      useFactory: (prisma: PrismaClient, log: Logger) => new PrismaHistoryRepository(prisma, log),
    },
  ],
  exports: [PRISMA_CLIENT, APP_STATE_REPOSITORY, ARCHIVE_REPOSITORY, HISTORY_REPOSITORY],
})
export class PersistenceModule {}
