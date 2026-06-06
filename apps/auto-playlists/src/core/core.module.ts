import { Module } from "@nestjs/common";
import { loadConfig } from "./config.js";
import { logger } from "./logger.js";
import { APP_CONFIG, APP_LOCALE, APP_LOGGER, FETCH_IMPL } from "./nest.tokens.js";

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
      provide: APP_LOCALE,
      useFactory: () => loadConfig().appLocale,
    },
    {
      provide: FETCH_IMPL,
      useValue: fetch,
    },
  ],
  exports: [APP_CONFIG, APP_LOGGER, APP_LOCALE, FETCH_IMPL],
})
export class CoreModule {}
