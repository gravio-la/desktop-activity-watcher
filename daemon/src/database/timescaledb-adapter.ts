/**
 * TimescaleDB adapter for desktop agent events
 * 
 * Writes events to PostgreSQL/TimescaleDB as hypertable rows
 */

import { Client } from 'pg';
import type { DatabaseAdapter } from './adapter';
import type { Event, WindowEvent, FileEvent, CorrelatedEvent } from '../schemas';
import type { TimescaleDBConfig } from './config';
import { logger } from '../logger';

export class TimescaleDBAdapter implements DatabaseAdapter {
  readonly name = 'TimescaleDB';
  
  private client: Client | null = null;
  private config: TimescaleDBConfig;

  constructor(config: TimescaleDBConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    try {
      this.client = new Client({
        connectionString: this.config.connectionString,
      });
      
      await this.client.connect();
      
      // Create tables if they don't exist
      await this.initializeTables();
      
      logger.info(`✅ ${this.name} connected`);
    } catch (error) {
      logger.error(`❌ ${this.name} connection failed:`, error);
      throw error;
    }
  }

  private async initializeTables(): Promise<void> {
    if (!this.client) return;

    try {
      // Create main events table
      await this.client.query(`
        CREATE TABLE IF NOT EXISTS desktop_agent_events (
          time TIMESTAMPTZ NOT NULL,
          event_type TEXT NOT NULL,
          event_data JSONB NOT NULL
        );
      `);

      // Convert to hypertable (idempotent - does nothing if already a hypertable)
      await this.client.query(`
        SELECT create_hypertable(
          'desktop_agent_events',
          'time',
          if_not_exists => TRUE
        );
      `);

      // Create indexes for common queries
      await this.client.query(`
        CREATE INDEX IF NOT EXISTS idx_event_type 
        ON desktop_agent_events (event_type, time DESC);
      `);

      await this.client.query(`
        CREATE INDEX IF NOT EXISTS idx_event_data_pid 
        ON desktop_agent_events ((event_data->>'pid'));
      `);

      logger.debug(`${this.name}: Tables initialized`);
    } catch (error) {
      logger.error(`${this.name}: Failed to initialize tables:`, error);
      throw error;
    }
  }

  async writeEvent(event: Event): Promise<void> {
    if (!this.client) {
      logger.warn(`${this.name}: Not connected, skipping write`);
      return;
    }

    try {
      const timestamp = new Date(event.timestamp);
      
      await this.client.query(
        `INSERT INTO desktop_agent_events (time, event_type, event_data) 
         VALUES ($1, $2, $3)`,
        [timestamp, event.type, JSON.stringify(event)]
      );
    } catch (error) {
      logger.error(`${this.name}: Failed to write event:`, error);
      // Don't throw - we don't want to crash the daemon
    }
  }

  async close(): Promise<void> {
    try {
      if (this.client) {
        await this.client.end();
        this.client = null;
      }
      logger.info(`${this.name}: Connection closed`);
    } catch (error) {
      logger.error(`${this.name}: Error closing connection:`, error);
    }
  }
}

