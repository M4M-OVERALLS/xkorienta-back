/**
 * Minimal structured logger.
 * Wraps console methods so they can be swapped out (e.g., for Winston/Pino)
 * without touching call sites.
 */
const logger = {
  info: (message: string, ...args: unknown[]): void => {
    if (process.env.NODE_ENV !== "development") {
      // eslint-disable-next-line no-console
      console.info(`[INFO] ${message}`, ...args);
    }
  },
  warn: (message: string, ...args: unknown[]): void => {
      if (process.env.NODE_ENV !== "development") {
      // eslint-disable-next-line no-console
      console.warn(`[WARN] ${message}`, ...args);
    }
  },
  error: (message: string, ...args: unknown[]): void => {
    // eslint-disable-next-line no-console
    console.error(`[ERROR] ${message}`, ...args);
  },
};

export default logger;
