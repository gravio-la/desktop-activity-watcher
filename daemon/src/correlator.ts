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

export class EventCorrelator {
  private logFile: string;
  private fileHandle: any = null;
  private currentWindow: WindowEvent | null = null;
  private dbWriter: DatabaseWriter | null;
  private keepJsonl: boolean;
  private config: Config;
  private stats = {
    windowEvents: 0,
    fileEvents: 0,
    correlatedEvents: 0,
    filteredEvents: 0,
  };

  constructor(
    logFile: string, 
    dbWriter: DatabaseWriter | null = null, 
    keepJsonl: boolean = true,
    config: Config
  ) {
    this.logFile = logFile;
    this.dbWriter = dbWriter;
    this.keepJsonl = keepJsonl;
    this.config = config;
  }

  async init(): Promise<void> {
    // Open log file for appending if keepJsonl is enabled
    if (this.keepJsonl) {
      try {
        this.fileHandle = await Bun.file(this.logFile).writer();
        logger.info(`📝 Writing events to JSONL: ${this.logFile}`);
      } catch (error) {
        logger.warn(`⚠️  Failed to open JSONL file: ${this.logFile}`);
        if (error instanceof Error) {
          logger.warn(`   ${error.message}`);
        }
        logger.warn(`   JSONL logging disabled, using databases only`);
        this.keepJsonl = false;
      }
    }
    
    // Initialize database writer
    if (this.dbWriter) {
      await this.dbWriter.connect();
      logger.info('📝 Writing events to databases');
    }
  }

  async close(): Promise<void> {
    // Give pending async writes a moment to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (this.fileHandle) {
      await this.fileHandle.flush();
      await this.fileHandle.end();
      this.fileHandle = null;
    }

    if (this.dbWriter) {
      await this.dbWriter.close();
    }

    logger.info('📊 Event statistics:');
    logger.info(`   Window events: ${this.stats.windowEvents}`);
    logger.info(`   File events: ${this.stats.fileEvents}`);
    logger.info(`   Correlated events: ${this.stats.correlatedEvents}`);
    logger.info(`   Filtered events: ${this.stats.filteredEvents}`);
  }

  handleWindowEvent(event: WindowEvent): void {
    this.currentWindow = event;
    this.stats.windowEvents++;

    // Write to databases and/or log file
    this.writeEvent({
      type: 'window_activated',
      ...event,
    });
  }

  handleFileEvent(event: FileEvent): void {
    // Apply file filters
    if (!shouldMonitorFile(event.filePath, this.config)) {
      this.stats.filteredEvents++;
      logger.debug(`🚫 Filtered file: ${event.filePath}`);
      return;
    }

    // Apply process filters
    if (!shouldMonitorProcess(event.processName, this.config)) {
      this.stats.filteredEvents++;
      logger.debug(`🚫 Filtered process: ${event.processName}`);
      return;
    }

    this.stats.fileEvents++;

    // Check if we can correlate with current window
    if (this.currentWindow && event.pid === this.currentWindow.pid) {
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

    // Write raw file event
    this.writeEvent(event);
  }

  private writeEvent(event: any): void {
    // Write to database if available
    if (this.dbWriter) {
      this.dbWriter.writeEvent(event).catch(err => {
        logger.error('Failed to write event to database:', err);
      });
    }

    // Write to JSONL file if enabled
    if (this.keepJsonl) {
      if (!this.fileHandle) {
        // Lazy init
        Bun.write(this.logFile, JSON.stringify(event) + '\n', { createPath: true });
      } else {
        this.fileHandle.write(JSON.stringify(event) + '\n');
      }
    }
  }
}

