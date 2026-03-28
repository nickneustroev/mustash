const ts = () => new Date().toISOString();
export const logger = {
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
//# sourceMappingURL=logger.js.map