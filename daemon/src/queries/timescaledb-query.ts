/**
 * TimescaleDB Query Functions
 */

import { Client } from 'pg';
import type { TimescaleDBConfig } from '../database/config';

export interface QueryOptions {
  eventType?: string;
  since: Date;
  limit?: number;
}

export interface QueryResult {
  time: string;
  event_type: string;
  data: any;
}

export async function queryTimescaleDB(
  config: TimescaleDBConfig,
  options: QueryOptions
): Promise<QueryResult[]> {
  const client = new Client({
    connectionString: config.connectionString,
  });

  try {
    await client.connect();
    
    let query = `
      SELECT 
        time, 
        event_type, 
        event_data
      FROM desktop_agent_events
      WHERE time >= $1
    `;
    
    const params: any[] = [options.since];
    
    if (options.eventType) {
      query += ` AND event_type = $2`;
      params.push(options.eventType);
    }
    
    query += ` ORDER BY time DESC LIMIT $${params.length + 1}`;
    params.push(options.limit || 20);
    
    const result = await client.query(query, params);
    
    return result.rows.map(row => ({
      time: new Date(row.time).toISOString(),
      event_type: row.event_type,
      data: row.event_data,
    }));
  } finally {
    await client.end();
  }
}

