/**
 * Simple logger utility
 */

export const logger = {
  info: (...args: unknown[]) => {
    console.log('[INFO]', new Date().toISOString(), ...args);
  },

  warn: (...args: unknown[]) => {
    console.warn('[WARN]', new Date().toISOString(), ...args);
  },

  error: (...args: unknown[]) => {
    console.error('[ERROR]', new Date().toISOString(), ...args);
  },

  debug: (...args: unknown[]) => {
    if (process.env.DEBUG === 'true') {
      console.debug('[DEBUG]', new Date().toISOString(), ...args);
    }
  }
};
