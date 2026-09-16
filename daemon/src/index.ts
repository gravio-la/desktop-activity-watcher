#!/usr/bin/env bun
/**
 * Desktop Agent Daemon
 *
 * Integrates window focus tracking from KWin with file access monitoring via opensnoop
 * Writes events to TimescaleDB (primary), optional InfluxDB/Redis, and JSONL
 */

import { logger } from './logger';
import { WindowTracker } from './window-tracker';
import { FileMonitor } from './file-monitor';
import { EventCorrelator } from './correlator';
import { DatabaseWriter } from './database/writer';
import { loadDatabaseConfig, buildTimescaleConnectionString } from './database/config';
import { InfluxDBAdapter } from './database/influxdb-adapter';
import { TimescaleDBAdapter } from './database/timescaledb-adapter';
import { RedisAdapter } from './database/redis-adapter';
import { loadConfig, expandEnvVars } from './config-loader';
import { warnIfKwinScriptNotLoaded } from './kwin-check';

const HOME_DIR = process.env.HOME || '/home/user';
const LOG_FILE = process.env.LOG_FILE || '/tmp/desktop-agent-events.jsonl';

function resolveTimescaleConnectionString(appConfig: Awaited<ReturnType<typeof loadConfig>>): string {
  const fromConfig = appConfig.databases?.timescaledb?.connectionString;
  if (fromConfig) {
    return fromConfig;
  }
  return buildTimescaleConnectionString();
}

async function main() {
  logger.info('🚀 Desktop Agent Daemon starting...');
  logger.info(`📁 Home directory: ${HOME_DIR}`);

  const realUser = process.env.SUDO_USER || process.env.USER || 'unknown';
  const realUid = process.env.SUDO_UID ? parseInt(process.env.SUDO_UID) : process.getuid?.();

  logger.info(`👤 Running as: ${realUser} (UID: ${realUid})`);

  const isRoot = process.getuid?.() === 0;
  if (!isRoot) {
    logger.warn('⚠️  Not running as root - file monitoring will not work');
    logger.warn('   The HM module uses sudo-wrapped opensnoop; run via systemd user service');
  } else {
    logger.info('✓ Running with root privileges (needed for eBPF)');
  }

  try {
    const appConfig = await loadConfig();

    if (!appConfig.monitoring.enabled) {
      logger.warn('⚠️  monitoring.enabled is false — file monitor will still start (config flag not wired to skip)');
    }

    if (appConfig.monitoring.fileFilters?.enabled) {
      logger.info('📋 File filters enabled:');
      logger.info(`   Mode: ${appConfig.monitoring.fileFilters.mode}`);
      logger.info(`   Patterns: ${appConfig.monitoring.fileFilters.patterns?.length || 0}`);
      appConfig.monitoring.fileFilters.patterns?.forEach((p) => {
        logger.info(`     - ${p}`);
      });
      if (appConfig.monitoring.fileFilters.excludePatterns?.length) {
        logger.info(`   Exclude patterns: ${appConfig.monitoring.fileFilters.excludePatterns.length}`);
      }
    }

    const dbConfig = appConfig.databases
      ? {
          influxdb: {
            enabled: appConfig.databases.influxdb?.enabled ?? false,
            url: appConfig.databases.influxdb?.url ?? 'http://localhost:8086',
            token: appConfig.databases.influxdb?.token ?? 'desktop-agent-token-123',
            org: appConfig.databases.influxdb?.org ?? 'desktop-agent',
            bucket: appConfig.databases.influxdb?.bucket ?? 'file-access',
          },
          timescaledb: {
            enabled: appConfig.databases.timescaledb?.enabled ?? false,
            connectionString: resolveTimescaleConnectionString(appConfig),
          },
          redis: {
            enabled: appConfig.databases.redis?.enabled ?? false,
            url: appConfig.databases.redis?.url ?? 'redis://localhost:6379',
          },
          keepJsonl: appConfig.databases.jsonl?.enabled ?? false,
        }
      : loadDatabaseConfig();

    const logFile = expandEnvVars(appConfig.databases?.jsonl?.path ?? LOG_FILE);
    logger.info(`📝 Event log path: ${logFile}`);

    const adapters = [];

    if (dbConfig.influxdb.enabled) {
      logger.info('🔌 Enabling InfluxDB adapter');
      adapters.push(new InfluxDBAdapter(dbConfig.influxdb));
    }

    if (dbConfig.timescaledb.enabled) {
      logger.info('🔌 Enabling TimescaleDB adapter');
      adapters.push(new TimescaleDBAdapter(dbConfig.timescaledb));
    }

    if (dbConfig.redis.enabled) {
      logger.info('🔌 Enabling Redis adapter');
      adapters.push(new RedisAdapter(dbConfig.redis));
    }

    if (adapters.length === 0) {
      logger.warn('⚠️  No database adapters enabled — events will not persist unless JSONL is on');
    }

    const dbWriter = adapters.length > 0 ? new DatabaseWriter(adapters) : null;

    const correlator = new EventCorrelator(logFile, dbWriter, dbConfig.keepJsonl, appConfig);
    const windowTracker = new WindowTracker();

    const homeDir = expandEnvVars(appConfig.monitoring.homeDirectory);
    const fileMonitor = new FileMonitor(homeDir);

    await correlator.init();

    warnIfKwinScriptNotLoaded();

    windowTracker.on('window-activated', (event) => {
      correlator.handleWindowEvent(event);
    });

    fileMonitor.on('file-accessed', (event) => {
      correlator.handleFileEvent(event);
    });

    logger.info('🎯 Starting window tracker...');
    await windowTracker.start();

    logger.info('📂 Starting file monitor...');
    await fileMonitor.start();

    logger.info('✅ Desktop Agent Daemon is running');
    logger.info('   Press Ctrl+C to stop');

    process.on('SIGINT', async () => {
      logger.info('');
      logger.info('🛑 Shutting down...');

      await windowTracker.stop();
      await fileMonitor.stop();
      await correlator.close();

      logger.info('✅ Shutdown complete');
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('🛑 Received SIGTERM, shutting down...');
      await windowTracker.stop();
      await fileMonitor.stop();
      await correlator.close();
      process.exit(0);
    });

    await new Promise(() => {});
  } catch (error) {
    logger.error('❌ Fatal error:');
    if (error instanceof Error) {
      logger.error(`   Message: ${error.message}`);
      logger.error(`   Stack: ${error.stack}`);
    } else {
      logger.error(`   ${String(error)}`);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error('Fatal error in main:');
  if (error instanceof Error) {
    logger.error(`   Message: ${error.message}`);
    logger.error(`   Stack: ${error.stack}`);
  } else {
    logger.error(`   ${String(error)}`);
  }
  process.exit(1);
});
