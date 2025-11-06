#!/usr/bin/env bun
/**
 * Desktop Agent Daemon
 * 
 * Integrates window focus tracking from KWin with file access monitoring via opensnoop
 * Provides unified logging and will eventually write to time series databases
 */

import { logger } from './logger';
import { WindowTracker } from './window-tracker';
import { FileMonitor } from './file-monitor';
import { EventCorrelator } from './correlator';

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
    // Initialize components
    const correlator = new EventCorrelator(LOG_FILE);
    const windowTracker = new WindowTracker();
    const fileMonitor = new FileMonitor(HOME_DIR);

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
    logger.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Start the daemon
main().catch((error) => {
  logger.error('Fatal error in main:', error);
  process.exit(1);
});

