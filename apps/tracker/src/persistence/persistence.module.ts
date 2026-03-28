import { Module } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import { PrismaArchiveRepository } from "./archive-repository.js";
import { type AppConfig } from "../core/config.js";
import { CoreModule } from "../core/core.module.js";
import { createPrismaClient, PrismaHistoryRepository } from "./history-repository.js";
import {
  APP_CONFIG,
  ARCHIVE_REPOSITORY,
  HISTORY_REPOSITORY,
  PRISMA_CLIENT,
  SAVED_TRACK_REPOSITORY,
} from "../core/nest.tokens.js";
import { PrismaSavedTrackRepository } from "./saved-track-repository.js";

@Module({
  imports: [CoreModule],
  providers: [
    {
      provide: PRISMA_CLIENT,
      inject: [APP_CONFIG],
      useFactory: (cfg: AppConfig): PrismaClient => createPrismaClient(cfg.databaseUrl),
    },
    {
      provide: HISTORY_REPOSITORY,
      useClass: PrismaHistoryRepository,
    },
    {
      provide: SAVED_TRACK_REPOSITORY,
      useClass: PrismaSavedTrackRepository,
    },
    {
      provide: ARCHIVE_REPOSITORY,
      useClass: PrismaArchiveRepository,
    },
  ],
  exports: [PRISMA_CLIENT, HISTORY_REPOSITORY, SAVED_TRACK_REPOSITORY, ARCHIVE_REPOSITORY],
})
export class PersistenceModule {}
