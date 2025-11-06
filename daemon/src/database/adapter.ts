/**
 * Database adapter interface
 * 
 * Common interface for all database implementations
 * Each adapter handles connection, writing, and cleanup
 */

import type { Event } from '../schemas';

export interface DatabaseAdapter {
  /**
   * Name of the database adapter (for logging)
   */
  readonly name: string;

  /**
   * Connect to the database
   * Should be idempotent (safe to call multiple times)
   */
  connect(): Promise<void>;

  /**
   * Write an event to the database
   * Should not throw - errors should be logged internally
   */
  writeEvent(event: Event): Promise<void>;

  /**
   * Close connection and cleanup resources
   */
  close(): Promise<void>;
}

