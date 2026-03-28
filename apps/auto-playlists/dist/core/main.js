import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { logger } from "./logger.js";
async function main() {
    const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    let shuttingDown = false;
    const shutdown = async (signal) => {
        if (shuttingDown) {
            return;
        }
        shuttingDown = true;
        logger.info(`Received ${signal}, shutting down.`);
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
    logger.error(error.message);
    process.exit(1);
});
//# sourceMappingURL=main.js.map