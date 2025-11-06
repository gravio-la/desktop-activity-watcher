#!/usr/bin/env bun
/**
 * Desktop Agent CLI
 * 
 * Query events from databases
 */

import { command, run, subcommands, option, string, number, optional } from 'cmd-ts';
import { sub, parseISO } from 'date-fns';
import { loadDatabaseConfig } from './database/config';
import { queryInfluxDB } from './queries/influxdb-query';
import { queryTimescaleDB } from './queries/timescaledb-query';
import { queryRedis } from './queries/redis-query';

// Parse time duration like "5m", "1h", "30s"
function parseDuration(duration: string): Date {
  const now = new Date();
  const match = duration.match(/^(\d+)([smhd])$/);
  
  if (!match) {
    throw new Error('Invalid duration format. Use: 5m, 1h, 30s, 2d');
  }
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  switch (unit) {
    case 's': return sub(now, { seconds: value });
    case 'm': return sub(now, { minutes: value });
    case 'h': return sub(now, { hours: value });
    case 'd': return sub(now, { days: value });
    default: throw new Error('Invalid time unit');
  }
}

// List command
const listCommand = command({
  name: 'list',
  description: 'List events from databases',
  args: {
    type: option({
      type: optional(string),
      long: 'type',
      short: 't',
      description: 'Event type: window, file, or correlated',
    }),
    since: option({
      type: optional(string),
      long: 'since',
      short: 's',
      description: 'Time range: 5m, 1h, 2d, etc.',
    }),
    limit: option({
      type: optional(number),
      long: 'limit',
      short: 'l',
      description: 'Maximum number of events',
      defaultValue: () => 20,
    }),
    database: option({
      type: optional(string),
      long: 'database',
      short: 'd',
      description: 'Database: influxdb, timescaledb, redis, or all',
      defaultValue: () => 'all',
    }),
  },
  handler: async (args) => {
    const config = loadDatabaseConfig();
    
    // Parse time range
    const since = args.since ? parseDuration(args.since) : sub(new Date(), { hours: 1 });
    
    // Map event type to internal format
    const eventType = args.type ? 
      args.type === 'window' ? 'window_activated' :
      args.type === 'file' ? 'file_accessed' :
      args.type === 'correlated' ? 'correlated' :
      args.type : undefined;
    
    console.log('🔍 Querying databases...');
    console.log(`   Type: ${eventType || 'all'}`);
    console.log(`   Since: ${since.toISOString()}`);
    console.log(`   Limit: ${args.limit}\n`);
    
    // Query InfluxDB
    if (args.database === 'all' || args.database === 'influxdb') {
      if (config.influxdb.enabled) {
        console.log('📊 InfluxDB Results:');
        console.log('─'.repeat(80));
        try {
          const results = await queryInfluxDB(config.influxdb, {
            eventType,
            since,
            limit: args.limit,
          });
          
          if (results.length === 0) {
            console.log('   No events found');
          } else {
            results.forEach((event, i) => {
              console.log(`${i + 1}. [${event.time}] ${event.event_type}`);
              console.log(`   ${JSON.stringify(event.data, null, 2).split('\n').join('\n   ')}`);
            });
          }
          console.log(`   Total: ${results.length} events\n`);
        } catch (error) {
          console.error(`   Error: ${error instanceof Error ? error.message : String(error)}\n`);
        }
      }
    }
    
    // Query TimescaleDB
    if (args.database === 'all' || args.database === 'timescaledb') {
      if (config.timescaledb.enabled) {
        console.log('🐘 TimescaleDB Results:');
        console.log('─'.repeat(80));
        try {
          const results = await queryTimescaleDB(config.timescaledb, {
            eventType,
            since,
            limit: args.limit,
          });
          
          if (results.length === 0) {
            console.log('   No events found');
          } else {
            results.forEach((event, i) => {
              console.log(`${i + 1}. [${event.time}] ${event.event_type}`);
              console.log(`   ${JSON.stringify(event.data, null, 2).split('\n').join('\n   ')}`);
            });
          }
          console.log(`   Total: ${results.length} events\n`);
        } catch (error) {
          console.error(`   Error: ${error instanceof Error ? error.message : String(error)}\n`);
        }
      }
    }
    
    // Query Redis
    if (args.database === 'all' || args.database === 'redis') {
      if (config.redis.enabled) {
        console.log('🔴 Redis Results:');
        console.log('─'.repeat(80));
        try {
          const results = await queryRedis(config.redis, {
            eventType,
            since,
            limit: args.limit,
          });
          
          if (results.length === 0) {
            console.log('   No events found');
          } else {
            results.forEach((event, i) => {
              console.log(`${i + 1}. [${event.time}] ${event.event_type}`);
              console.log(`   ${JSON.stringify(event.data, null, 2).split('\n').join('\n   ')}`);
            });
          }
          console.log(`   Total: ${results.length} events\n`);
        } catch (error) {
          console.error(`   Error: ${error instanceof Error ? error.message : String(error)}\n`);
        }
      }
    }
  },
});

// Stats command
const statsCommand = command({
  name: 'stats',
  description: 'Show event statistics',
  args: {
    since: option({
      type: optional(string),
      long: 'since',
      short: 's',
      description: 'Time range: 5m, 1h, 2d, etc.',
    }),
    database: option({
      type: optional(string),
      long: 'database',
      short: 'd',
      description: 'Database: influxdb, timescaledb, redis, or all',
      defaultValue: () => 'timescaledb',
    }),
  },
  handler: async (args) => {
    const config = loadDatabaseConfig();
    const since = args.since ? parseDuration(args.since) : sub(new Date(), { hours: 1 });
    
    console.log(`📊 Event Statistics (since ${since.toISOString()})\n`);
    
    // Query TimescaleDB (most reliable for stats)
    if ((args.database === 'all' || args.database === 'timescaledb') && config.timescaledb.enabled) {
      try {
        const { countsByType, total } = await queryTimescaleDBStats(config.timescaledb, since);
        console.log('🐘 TimescaleDB:');
        console.log(`   Total events: ${total}`);
        Object.entries(countsByType).forEach(([type, count]) => {
          console.log(`   - ${type}: ${count}`);
        });
        console.log();
      } catch (error) {
        console.error(`   Error: ${error instanceof Error ? error.message : String(error)}\n`);
      }
    }
    
    // Query InfluxDB
    if ((args.database === 'all' || args.database === 'influxdb') && config.influxdb.enabled) {
      try {
        const stats = await queryInfluxDBStats(config.influxdb, since);
        console.log('📊 InfluxDB:');
        console.log(`   Total events: ${stats.total}`);
        Object.entries(stats.countsByType).forEach(([type, count]) => {
          console.log(`   - ${type}: ${count}`);
        });
        console.log();
      } catch (error) {
        console.error(`   Error: ${error instanceof Error ? error.message : String(error)}\n`);
      }
    }
    
    // Note: Redis doesn't efficiently support count queries, so we skip it for stats
    if (args.database === 'redis') {
      console.log('⚠️  Redis stats not available (use TimescaleDB or InfluxDB for statistics)\n');
    }
  },
});

// Root command
const app = subcommands({
  name: 'desktop-agent-cli',
  description: 'Desktop Agent database query tool',
  cmds: {
    list: listCommand,
    stats: statsCommand,
  },
});

// Stats query functions
async function queryTimescaleDBStats(config: any, since: Date) {
  const { Client } = await import('pg');
  const client = new Client({ connectionString: config.connectionString });
  
  try {
    await client.connect();
    
    const result = await client.query(
      `SELECT 
        event_type, 
        COUNT(*) as count 
      FROM desktop_agent_events 
      WHERE time >= $1 
      GROUP BY event_type`,
      [since]
    );
    
    const countsByType: Record<string, number> = {};
    let total = 0;
    
    result.rows.forEach(row => {
      countsByType[row.event_type] = parseInt(row.count);
      total += parseInt(row.count);
    });
    
    return { countsByType, total };
  } finally {
    await client.end();
  }
}

async function queryInfluxDBStats(config: any, since: Date) {
  const { InfluxDB } = await import('@influxdata/influxdb-client');
  const client = new InfluxDB({ url: config.url, token: config.token });
  const queryApi = client.getQueryApi(config.org);
  
  const query = `
    from(bucket: "${config.bucket}")
      |> range(start: ${since.toISOString()})
      |> group(columns: ["_measurement"])
      |> count()
  `;
  
  const countsByType: Record<string, number> = {};
  let total = 0;
  
  return new Promise<{ countsByType: Record<string, number>, total: number }>((resolve, reject) => {
    queryApi.queryRows(query, {
      next(row: string[], tableMeta: any) {
        const o = tableMeta.toObject(row);
        const measurement = o._measurement || 'unknown';
        const count = parseInt(o._value) || 0;
        
        // Map measurement names to event types
        const eventType = measurement === 'window_event' ? 'window_activated' :
                         measurement === 'file_event' ? 'file_accessed' :
                         measurement === 'correlated_event' ? 'correlated' :
                         measurement;
        
        countsByType[eventType] = (countsByType[eventType] || 0) + count;
        total += count;
      },
      error(error: Error) {
        reject(error);
      },
      complete() {
        resolve({ countsByType, total });
      },
    });
  });
}

// Run CLI
run(app, process.argv.slice(2));

