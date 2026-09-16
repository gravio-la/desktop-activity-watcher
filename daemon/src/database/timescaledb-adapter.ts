/**
 * TimescaleDB adapter for desktop agent events
 *
 * Writes events to PostgreSQL/TimescaleDB as hypertable rows
 */

import { Client } from 'pg';
import type { DatabaseAdapter } from './adapter';
import type { Event } from '../schemas';
import type { TimescaleDBConfig } from './config';
import { logger } from '../logger';

const MAX_CONNECT_ATTEMPTS = 10;
const CONNECT_RETRY_MS = 3000;

export class TimescaleDBAdapter implements DatabaseAdapter {
  readonly name = 'TimescaleDB';

  private client: Client | null = null;
  private config: TimescaleDBConfig;

  constructor(config: TimescaleDBConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_CONNECT_ATTEMPTS; attempt++) {
      try {
        this.client = new Client({
          connectionString: this.config.connectionString,
        });

        await this.client.connect();
        await this.initializeTables();

        logger.info(`✅ ${this.name} connected`);
        return;
      } catch (error) {
        lastError = error;
        if (this.client) {
          try {
            await this.client.end();
          } catch {
            // ignore cleanup errors
          }
          this.client = null;
        }

        if (attempt < MAX_CONNECT_ATTEMPTS) {
          logger.warn(
            `${this.name}: connect attempt ${attempt}/${MAX_CONNECT_ATTEMPTS} failed, retrying in ${CONNECT_RETRY_MS}ms`
          );
          await new Promise((resolve) => setTimeout(resolve, CONNECT_RETRY_MS));
        }
      }
    }

    logger.error(`❌ ${this.name} connection failed after ${MAX_CONNECT_ATTEMPTS} attempts:`, lastError);
    throw lastError;
  }

  private async initializeTables(): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.query('CREATE EXTENSION IF NOT EXISTS timescaledb');

      await this.client.query(`
        CREATE TABLE IF NOT EXISTS desktop_agent_events (
          time TIMESTAMPTZ NOT NULL,
          event_type TEXT NOT NULL,
          event_data JSONB NOT NULL
        );
      `);

      await this.client.query(`
        SELECT create_hypertable(
          'desktop_agent_events',
          'time',
          if_not_exists => TRUE
        );
      `);

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
