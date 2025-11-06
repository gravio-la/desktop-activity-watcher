/**
 * Event Correlator
 * 
 * Correlates window events with file access events
 * Writes unified log output
 */

import { logger } from './logger';
import type { WindowEvent, FileEvent, CorrelatedEvent } from './types';

export class EventCorrelator {
  private logFile: string;
  private fileHandle: any = null;
  private currentWindow: WindowEvent | null = null;
  private stats = {
    windowEvents: 0,
    fileEvents: 0,
    correlatedEvents: 0,
  };

  constructor(logFile: string) {
    this.logFile = logFile;
  }

  async init(): Promise<void> {
    // Open log file for appending
    this.fileHandle = await Bun.file(this.logFile).writer();
    logger.info(`📝 Writing events to: ${this.logFile}`);
  }

  async close(): Promise<void> {
    if (this.fileHandle) {
      await this.fileHandle.flush();
      await this.fileHandle.end();
      this.fileHandle = null;
    }

    logger.info('📊 Event statistics:');
    logger.info(`   Window events: ${this.stats.windowEvents}`);
    logger.info(`   File events: ${this.stats.fileEvents}`);
    logger.info(`   Correlated events: ${this.stats.correlatedEvents}`);
  }

  handleWindowEvent(event: WindowEvent): void {
    this.currentWindow = event;
    this.stats.windowEvents++;

    // Write to log file
    this.writeEvent({
      type: 'window_activated',
      ...event,
    });
  }

  handleFileEvent(event: FileEvent): void {
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
    if (!this.fileHandle) {
      // Lazy init
      Bun.write(this.logFile, JSON.stringify(event) + '\n', { createPath: true });
    } else {
      this.fileHandle.write(JSON.stringify(event) + '\n');
    }
  }
}

