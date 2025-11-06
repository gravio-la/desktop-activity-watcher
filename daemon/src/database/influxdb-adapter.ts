/**
 * InfluxDB adapter for desktop agent events
 * 
 * Writes events to InfluxDB as time series measurements
 */

import { InfluxDB, Point, WriteApi } from '@influxdata/influxdb-client';
import type { DatabaseAdapter } from './adapter';
import type { Event, WindowEvent, FileEvent, CorrelatedEvent } from '../schemas';
import type { InfluxDBConfig } from './config';
import { logger } from '../logger';

export class InfluxDBAdapter implements DatabaseAdapter {
  readonly name = 'InfluxDB';
  
  private client: InfluxDB;
  private writeApi: WriteApi | null = null;
  private config: InfluxDBConfig;

  constructor(config: InfluxDBConfig) {
    this.config = config;
    this.client = new InfluxDB({
      url: config.url,
      token: config.token,
    });
  }

  async connect(): Promise<void> {
    try {
      this.writeApi = this.client.getWriteApi(this.config.org, this.config.bucket);
      // Configure write options
      this.writeApi.useDefaultTags({ source: 'desktop-agent' });
      logger.info(`✅ ${this.name} connected: ${this.config.url}`);
    } catch (error) {
      logger.error(`❌ ${this.name} connection failed:`, error);
      throw error;
    }
  }

  async writeEvent(event: Event): Promise<void> {
    if (!this.writeApi) {
      logger.warn(`${this.name}: Not connected, skipping write`);
      return;
    }

    try {
      const point = this.eventToPoint(event);
      this.writeApi.writePoint(point);
      // Flush immediately for now (can be optimized later with batching)
      await this.writeApi.flush();
    } catch (error) {
      logger.error(`${this.name}: Failed to write event:`, error);
      // Don't throw - we don't want to crash the daemon
    }
  }

  private eventToPoint(event: Event): Point {
    const timestamp = new Date(event.timestamp);

    switch (event.type) {
      case 'window_activated':
        return this.windowEventToPoint(event, timestamp);
      case 'file_accessed':
        return this.fileEventToPoint(event, timestamp);
      case 'correlated':
        return this.correlatedEventToPoint(event, timestamp);
    }
  }

  private windowEventToPoint(event: WindowEvent, timestamp: Date): Point {
    return new Point('window_event')
      .timestamp(timestamp)
      .tag('event_type', 'window_activated')
      .tag('application', event.resourceClass)
      .tag('resource_name', event.resourceName)
      .intField('pid', event.pid)
      .intField('window_id', event.windowId)
      .intField('desktop', event.desktop)
      .intField('screen', event.screen)
      .stringField('window_title', event.windowTitle)
      .stringField('activities', event.activities.join(','))
      .intField('geometry_x', event.geometry.x)
      .intField('geometry_y', event.geometry.y)
      .intField('geometry_width', event.geometry.width)
      .intField('geometry_height', event.geometry.height);
  }

  private fileEventToPoint(event: FileEvent, timestamp: Date): Point {
    const point = new Point('file_event')
      .timestamp(timestamp)
      .tag('event_type', 'file_accessed')
      .tag('operation', event.operation)
      .tag('process_name', event.processName)
      .intField('pid', event.pid)
      .intField('uid', event.uid)
      .stringField('file_path', event.filePath);

    if (event.fd !== undefined) {
      point.intField('fd', event.fd);
    }
    if (event.flags) {
      point.stringField('flags', event.flags);
    }

    return point;
  }

  private correlatedEventToPoint(event: CorrelatedEvent, timestamp: Date): Point {
    const point = new Point('correlated_event')
      .timestamp(timestamp)
      .tag('event_type', 'correlated');

    if (event.activeWindow) {
      point.tag('application', event.activeWindow.application);
      point.stringField('window_title', event.activeWindow.title);
      point.intField('window_pid', event.activeWindow.pid);
    }

    if (event.fileAccess) {
      point.tag('operation', event.fileAccess.operation);
      point.tag('process_name', event.fileAccess.process);
      point.stringField('file_path', event.fileAccess.path);
      point.intField('file_pid', event.fileAccess.pid);
    }

    return point;
  }

  async close(): Promise<void> {
    try {
      if (this.writeApi) {
        await this.writeApi.close();
        this.writeApi = null;
      }
      logger.info(`${this.name}: Connection closed`);
    } catch (error) {
      logger.error(`${this.name}: Error closing connection:`, error);
    }
  }
}

