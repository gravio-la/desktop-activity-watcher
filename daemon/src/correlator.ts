/**
 * Event Correlator
 *
 * Correlates window events with file access events
 * Writes to databases and optionally to JSONL file
 */

import { logger } from './logger';
import type { WindowEvent, FileEvent, CorrelatedEvent } from './types';
import type { DatabaseWriter } from './database/writer';
import type { Config } from './config-loader';
import { shouldMonitorFile, shouldMonitorProcess } from './config-loader';
import { JsonlSink } from './jsonl-sink';

export class EventCorrelator {
  private logFile: string;
  private jsonlSink: JsonlSink | null = null;
  private currentWindow: WindowEvent | null = null;
  private dbWriter: DatabaseWriter | null;
  private keepJsonl: boolean;
  private config: Config;
  private stats = {
    windowEvents: 0,
    fileEvents: 0,
    correlatedEvents: 0,
    filteredEvents: 0,
    skippedWindowEvents: 0,
  };

  constructor(
    logFile: string,
    dbWriter: DatabaseWriter | null = null,
    keepJsonl: boolean = false,
    config: Config
  ) {
    this.logFile = logFile;
    this.dbWriter = dbWriter;
    this.keepJsonl = keepJsonl;
    this.config = config;
  }

  async init(): Promise<void> {
    if (this.keepJsonl) {
      try {
        this.jsonlSink = new JsonlSink(this.logFile);
        await this.jsonlSink.open();
        logger.info(`📝 Writing events to JSONL (append): ${this.logFile}`);
      } catch (error) {
        logger.warn(`⚠️  Failed to open JSONL file: ${this.logFile}`);
        if (error instanceof Error) {
          logger.warn(`   ${error.message}`);
        }
        logger.warn('   JSONL logging disabled, using databases only');
        this.keepJsonl = false;
        this.jsonlSink = null;
      }
    }

    if (this.dbWriter) {
      await this.dbWriter.connect();
      logger.info('📝 Writing events to databases');
    }
  }

  async close(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (this.jsonlSink) {
      await this.jsonlSink.close();
      this.jsonlSink = null;
    }

    if (this.dbWriter) {
      await this.dbWriter.close();
    }

    logger.info('📊 Event statistics:');
    logger.info(`   Window events: ${this.stats.windowEvents}`);
    logger.info(`   File events: ${this.stats.fileEvents}`);
    logger.info(`   Correlated events: ${this.stats.correlatedEvents}`);
    logger.info(`   Filtered events: ${this.stats.filteredEvents}`);
    if (this.stats.skippedWindowEvents > 0) {
      logger.info(`   Skipped window events (invalid PID): ${this.stats.skippedWindowEvents}`);
    }
  }

  handleWindowEvent(event: WindowEvent): void {
    this.stats.windowEvents++;

    if (event.pid < 0) {
      this.stats.skippedWindowEvents++;
      logger.info(
        `🪟 Window without PID (no correlation): ${event.windowTitle} [${event.resourceClass}]`
      );
    } else {
      this.currentWindow = event;
    }

    this.writeEvent({
      type: 'window_activated',
      ...event,
    });
  }

  handleFileEvent(event: FileEvent): void {
    if (!shouldMonitorFile(event.filePath, this.config)) {
      this.stats.filteredEvents++;
      logger.debug(`🚫 Filtered file: ${event.filePath}`);
      return;
    }

    if (!shouldMonitorProcess(event.processName, this.config)) {
      this.stats.filteredEvents++;
      logger.debug(`🚫 Filtered process: ${event.processName}`);
      return;
    }

    this.stats.fileEvents++;

    logger.info(
      `📂 File access: ${event.filePath} by ${event.processName} (PID: ${event.pid})`
    );

    const correlationEnabled = this.config.correlation?.enabled !== false;
    const correlateByPid = this.config.correlation?.correlateByPid !== false;

    if (
      correlationEnabled &&
      correlateByPid &&
      this.currentWindow &&
      this.currentWindow.pid >= 0 &&
      event.pid === this.currentWindow.pid
    ) {
      this.stats.correlatedEvents++;

      const correlated: CorrelatedEvent = {
        timestamp: event.timestamp,
        activeWindow: {
          title: this.currentWindow.windowTitle,
          application: this.currentWindow.resourceClass,
          pid: this.currentWindow.pid,
        },
        fileAccess: {
          path: event.filePath,
          operation: event.operation,
          process: event.processName,
          processExecutablePath: event.processExecutablePath,
          processCommandLine: event.processCommandLine,
          pid: event.pid,
        },
      };

      logger.info(
        `🔗 Correlated: ${this.currentWindow.resourceClass} accessed ${event.filePath}`
      );

      this.writeEvent({
        type: 'correlated',
        ...correlated,
      });
    }

    this.writeEvent(event);
  }

  private writeEvent(event: unknown): void {
    if (this.dbWriter) {
      this.dbWriter.writeEvent(event).catch((err) => {
        logger.error('Failed to write event to database:', err);
      });
    }

    if (this.keepJsonl && this.jsonlSink) {
      this.jsonlSink.write(event).catch((err) => {
        logger.error('Failed to write event to JSONL:', err);
      });
    }
  }
}
