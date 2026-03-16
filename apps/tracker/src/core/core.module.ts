import { Module } from "@nestjs/common";
import { loadConfig } from "./config.js";
import { logger } from "./logger.js";
import { APP_CONFIG, APP_LOGGER, FETCH_IMPL } from "./nest.tokens.js";

@Module({
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: loadConfig,
    },
    {
      provide: APP_LOGGER,
      useValue: logger,
    },
    {
      provide: FETCH_IMPL,
      useValue: fetch,
    },
  ],
  exports: [APP_CONFIG, APP_LOGGER, FETCH_IMPL],
})
export class CoreModule {}
