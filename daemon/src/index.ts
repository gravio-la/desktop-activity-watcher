#!/usr/bin/env bun
/**
 * Desktop Agent Daemon
 * 
 * Integrates window focus tracking from KWin with file access monitoring via opensnoop
 * Writes events to InfluxDB, TimescaleDB, and Redis time series databases
 */

import { logger } from './logger';
import { WindowTracker } from './window-tracker';
import { FileMonitor } from './file-monitor';
import { EventCorrelator } from './correlator';
import { DatabaseWriter } from './database/writer';
import { loadDatabaseConfig } from './database/config';
import { InfluxDBAdapter } from './database/influxdb-adapter';
import { TimescaleDBAdapter } from './database/timescaledb-adapter';
import { RedisAdapter } from './database/redis-adapter';
import { loadConfig, expandEnvVars } from './config-loader';

const HOME_DIR = process.env.HOME || '/home/user';
const LOG_FILE = process.env.LOG_FILE || '/tmp/desktop-agent-events.jsonl';

async function main() {
  logger.info('🚀 Desktop Agent Daemon starting...');
  logger.info(`📁 Home directory: ${HOME_DIR}`);
  logger.info(`📝 Event log: ${LOG_FILE}`);

  // Get the real user (even if running with sudo)
  const realUser = process.env.SUDO_USER || process.env.USER || 'unknown';
  const realUid = process.env.SUDO_UID ? parseInt(process.env.SUDO_UID) : process.getuid?.();
  
  logger.info(`👤 Running as: ${realUser} (UID: ${realUid})`);
  
  // Check if we have the right privileges
  const isRoot = process.getuid?.() === 0;
  if (!isRoot) {
    logger.warn('⚠️  Not running as root - file monitoring will not work');
    logger.warn('   Please run with: sudo -E bun run src/index.ts');
    logger.warn('   (The -E flag preserves your environment variables)');
  } else {
    logger.info('✓ Running with root privileges (needed for eBPF)');
  }

  try {
    // Load configuration
    const appConfig = await loadConfig();
    
    // Log filter configuration
    if (appConfig.monitoring.fileFilters?.enabled) {
      logger.info('📋 File filters enabled:');
      logger.info(`   Mode: ${appConfig.monitoring.fileFilters.mode}`);
      logger.info(`   Patterns: ${appConfig.monitoring.fileFilters.patterns?.length || 0}`);
      if (appConfig.monitoring.fileFilters.patterns && appConfig.monitoring.fileFilters.patterns.length > 0) {
        appConfig.monitoring.fileFilters.patterns.forEach(p => {
          logger.info(`     - ${p}`);
        });
      }
    }
    
    // Load database configuration (with override from appConfig if present)
    const dbConfig = appConfig.databases ? {
      influxdb: {
        enabled: appConfig.databases.influxdb?.enabled ?? true,
        url: appConfig.databases.influxdb?.url ?? 'http://localhost:8086',
        token: appConfig.databases.influxdb?.token ?? 'desktop-agent-token-123',
        org: appConfig.databases.influxdb?.org ?? 'desktop-agent',
        bucket: appConfig.databases.influxdb?.bucket ?? 'file-access',
      },
      timescaledb: {
        enabled: appConfig.databases.timescaledb?.enabled ?? true,
        connectionString: appConfig.databases.timescaledb?.connectionString ?? 
          'postgresql://desktopagent:desktopagent123@localhost:5432/desktop_agent',
      },
      redis: {
        enabled: appConfig.databases.redis?.enabled ?? true,
        url: appConfig.databases.redis?.url ?? 'redis://localhost:6379',
      },
      keepJsonl: appConfig.databases.jsonl?.enabled ?? true,
    } : loadDatabaseConfig();
    
    // Initialize database adapters
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

    // Create database writer
    const dbWriter = adapters.length > 0 ? new DatabaseWriter(adapters) : null;

    // Get log file path from config
    const logFile = appConfig.databases?.jsonl?.path ?? LOG_FILE;

    // Initialize components
    const correlator = new EventCorrelator(logFile, dbWriter, dbConfig.keepJsonl, appConfig);
    const windowTracker = new WindowTracker();
    
    // Use home directory from config
    const homeDir = expandEnvVars(appConfig.monitoring.homeDirectory);
    const fileMonitor = new FileMonitor(homeDir);

    // Initialize correlator (connects to databases)
    await correlator.init();

    // Forward events to correlator
    windowTracker.on('window-activated', (event) => {
      correlator.handleWindowEvent(event);
    });

    fileMonitor.on('file-accessed', (event) => {
      correlator.handleFileEvent(event);
    });

    // Start monitoring
    logger.info('🎯 Starting window tracker...');
    await windowTracker.start();

    logger.info('📂 Starting file monitor...');
    await fileMonitor.start();

    logger.info('✅ Desktop Agent Daemon is running');
    logger.info('   Press Ctrl+C to stop');

    // Handle graceful shutdown
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

    // Keep process alive
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

// Start the daemon
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

