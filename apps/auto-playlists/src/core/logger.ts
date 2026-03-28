import type { Logger } from "../shared/types.js";

const ts = () => new Date().toISOString();

export const logger: Logger = {
  info(message) {
    console.log(`[${ts()}] INFO  ${message}`);
  },
  warn(message) {
    console.warn(`[${ts()}] WARN  ${message}`);
  },
  error(message) {
    console.error(`[${ts()}] ERROR ${message}`);
  },
};
