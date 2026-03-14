/**
 * Lightweight logger utility.
 * In production, debug logs are suppressed to avoid leaking internal state.
 * warn / error always log regardless of environment.
 */

const isDev = process.env.NODE_ENV === "development";

export const logger = {
  /** Debug-level log — suppressed in production */
  debug: (...args: unknown[]) => {
    if (isDev) console.log(...args);
  },

  /** Info-level log — suppressed in production */
  info: (...args: unknown[]) => {
    if (isDev) console.info(...args);
  },

  /** Warning — always logged */
  warn: (...args: unknown[]) => {
    console.warn(...args);
  },

  /** Error — always logged */
  error: (...args: unknown[]) => {
    console.error(...args);
  },
};
