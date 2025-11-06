/**
 * Redis adapter for desktop agent events
 * 
 * Writes events to Redis using RedisTimeSeries and JSON
 */

import { createClient, RedisClientType } from 'redis';
import type { DatabaseAdapter } from './adapter';
import type { Event } from '../schemas';
import type { RedisConfig } from './config';
import { logger } from '../logger';

export class RedisAdapter implements DatabaseAdapter {
  readonly name = 'Redis';
  
  private client: RedisClientType | null = null;
  private config: RedisConfig;
  private errorHandler: ((err: Error) => void) | null = null;
  private isClosing: boolean = false;

  constructor(config: RedisConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    try {
      this.client = createClient({
        url: this.config.url,
      });

      // Only log meaningful errors (not during shutdown/disconnect)
      this.errorHandler = (err: Error) => {
        if (!this.isClosing && this.client && this.client.isOpen) {
          logger.error(`${this.name} client error:`, err);
        }
      };
      
      this.client.on('error', this.errorHandler);

      await this.client.connect();
      
      logger.info(`✅ ${this.name} connected: ${this.config.url}`);
    } catch (error) {
      logger.error(`❌ ${this.name} connection failed:`, error);
      throw error;
    }
  }

  async writeEvent(event: Event): Promise<void> {
    if (!this.client || !this.client.isOpen) {
      // Silently skip if not connected (common during shutdown)
      return;
    }

    try {
      const timestamp = new Date(event.timestamp).getTime();
      
      // Store event as JSON with a unique key based on type and timestamp
      const key = `desktop_agent:events:${event.type}:${timestamp}`;
      
      // Store the event JSON with expiration (30 days)
      await this.client.setEx(
        key,
        30 * 24 * 60 * 60, // 30 days in seconds
        JSON.stringify(event)
      );

      // Also add to a sorted set for time-based queries
      const zsetKey = `desktop_agent:events:${event.type}:timeline`;
      await this.client.zAdd(zsetKey, {
        score: timestamp,
        value: key,
      });

      // Trim old entries from sorted set (keep last 10000)
      await this.client.zRemRangeByRank(zsetKey, 0, -10001);

    } catch (error) {
      // Only log if we're still connected (not during shutdown)
      if (this.client && this.client.isOpen) {
        logger.error(`${this.name}: Failed to write event:`, error);
      }
      // Don't throw - we don't want to crash the daemon
    }
  }

  async close(): Promise<void> {
    try {
      if (this.client && this.client.isOpen) {
        // Mark as closing FIRST to suppress disconnect errors in the handler
        this.isClosing = true;
        
        // Remove error handler before closing to avoid spurious errors
        if (this.errorHandler) {
          this.client.off('error', this.errorHandler);
          this.errorHandler = null;
        }
        
        // Use quit() for graceful shutdown (waits for pending commands)
        // quit() is the recommended way per Redis docs
        await this.client.quit();
        this.client = null;
      }
      logger.info(`${this.name}: Connection closed`);
    } catch (error) {
      // Silently handle close errors (common during daemon shutdown)
      if (this.client) {
        this.client = null;
      }
    } finally {
      this.isClosing = false;
    }
  }
}

