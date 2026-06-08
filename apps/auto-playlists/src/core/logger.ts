import type { Logger } from "../shared/types.js";

const ts = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

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
