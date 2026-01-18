/**
 * Logger configuration using Pino
 */

import pino from 'pino';

// Use pino-pretty only in development (when not compiled)
// Compiled binaries can't use dynamic imports for transports
// Check if we're running from a bundle (Bun.main will be /$bunfs/root/...)
const isCompiled = Bun.main.startsWith('/$bunfs/');
const usePretty = !isCompiled && process.env.LOG_PRETTY !== 'false';

export const logger = usePretty
  ? pino({
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
          messageFormat: '{msg}',
        },
      },
    })
  : pino({
      level: process.env.LOG_LEVEL || 'info',
    });

export type Logger = typeof logger;

