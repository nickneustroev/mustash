import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { loadConfig } from "./config.js";
import { initLocale, t } from "../i18n/index.js";
import { logger } from "./logger.js";

async function main(): Promise<void> {
  const cfg = loadConfig();
  initLocale(cfg.appLocale);

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info(t("receivedSignalShuttingDown", signal));
    await app.close();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

void main().catch((error) => {
  logger.error((error as Error).message);
  process.exit(1);
});
