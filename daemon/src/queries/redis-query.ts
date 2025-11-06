/**
 * Redis Query Functions
 */

import { createClient, RedisClientType } from 'redis';
import type { RedisConfig } from '../database/config';

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

export async function queryRedis(
  config: RedisConfig,
  options: QueryOptions
): Promise<QueryResult[]> {
  let client: any = null;
  
  try {
    client = createClient({
      url: config.url,
      socket: {
        reconnectStrategy: false, // Don't reconnect for CLI
      }
    });

    // Suppress error events during query
    client.on('error', () => {});
    
    await client.connect();
    
    const results: QueryResult[] = [];
    const sinceTimestamp = options.since.getTime();
    const limit = options.limit || 20;
    
    // Determine which event types to query
    const eventTypes = options.eventType 
      ? [options.eventType]
      : ['window_activated', 'file_accessed', 'correlated'];
    
    for (const eventType of eventTypes) {
      const timelineKey = `desktop_agent:events:${eventType}:timeline`;
      
      // Check if timeline exists
      const exists = await client.exists(timelineKey);
      if (!exists) continue;
      
      // Get keys from sorted set in reverse order (newest first)
      const keys = await client.zRange(
        timelineKey,
        0,
        limit - 1,
        { REV: true, BY: 'SCORE' }
      );
      
      // Fetch each event
      for (const key of keys) {
        const data = await client.get(key);
        if (data) {
          try {
            const event = JSON.parse(data);
            const eventTime = new Date(event.timestamp).getTime();
            
            // Filter by time
            if (eventTime >= sinceTimestamp) {
              results.push({
                time: event.timestamp,
                event_type: event.type,
                data: event,
              });
            }
          } catch (e) {
            // Skip malformed events
          }
        }
      }
    }
    
    // Sort by time (newest first) and limit
    results.sort((a, b) => 
      new Date(b.time).getTime() - new Date(a.time).getTime()
    );
    
    return results.slice(0, limit);
  } catch (error) {
    // Return empty results on error instead of crashing
    return [];
  } finally {
    if (client && client.isOpen) {
      try {
        // Use quit() for graceful shutdown
        await client.quit();
      } catch (e) {
        // Silently ignore shutdown errors
      }
    }
  }
}

