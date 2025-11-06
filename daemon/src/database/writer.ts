/**
 * Database Writer Facade
 * 
 * Coordinates writing events to multiple databases
 * Handles validation and error management
 */

import type { DatabaseAdapter } from './adapter';
import { EventSchema, type Event } from '../schemas';
import { logger } from '../logger';

export class DatabaseWriter {
  private adapters: DatabaseAdapter[] = [];
  private stats = {
    totalEvents: 0,
    validationErrors: 0,
    writeErrors: 0,
  };

  constructor(adapters: DatabaseAdapter[] = []) {
    this.adapters = adapters;
  }

  /**
   * Add a database adapter dynamically
   */
  addAdapter(adapter: DatabaseAdapter): void {
    this.adapters.push(adapter);
  }

  /**
   * Connect all adapters
   */
  async connect(): Promise<void> {
    const results = await Promise.allSettled(
      this.adapters.map(adapter => adapter.connect())
    );

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        logger.error(
          `Failed to connect ${this.adapters[index].name}:`,
          result.reason
        );
      }
    });

    // Count successful connections
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    logger.info(`📊 Connected to ${successCount}/${this.adapters.length} databases`);
  }

  /**
   * Validate and write an event to all adapters
   */
  async writeEvent(event: unknown): Promise<void> {
    this.stats.totalEvents++;

    // Validate event with Zod
    const parseResult = EventSchema.safeParse(event);
    
    if (!parseResult.success) {
      this.stats.validationErrors++;
      logger.error('Event validation failed:', parseResult.error.format());
      return;
    }

    const validatedEvent = parseResult.data;

    // Write to all adapters in parallel
    const results = await Promise.allSettled(
      this.adapters.map(adapter => adapter.writeEvent(validatedEvent))
    );

    // Log errors but don't crash
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.stats.writeErrors++;
        logger.error(
          `${this.adapters[index].name}: Write failed:`,
          result.reason
        );
      }
    });
  }

  /**
   * Close all adapters
   */
  async close(): Promise<void> {
    await Promise.allSettled(
      this.adapters.map(adapter => adapter.close())
    );

    logger.info('📊 Database Writer Statistics:');
    logger.info(`   Total events: ${this.stats.totalEvents}`);
    logger.info(`   Validation errors: ${this.stats.validationErrors}`);
    logger.info(`   Write errors: ${this.stats.writeErrors}`);
  }

  /**
   * Get current statistics
   */
  getStats() {
    return { ...this.stats };
  }
}

