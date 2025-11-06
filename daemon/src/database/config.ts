/**
 * Database configuration
 * 
 * Reads from environment variables with sensible defaults
 * Allows enabling/disabling individual databases
 */

export interface InfluxDBConfig {
  enabled: boolean;
  url: string;
  token: string;
  org: string;
  bucket: string;
}

export interface TimescaleDBConfig {
  enabled: boolean;
  connectionString: string;
}

export interface RedisConfig {
  enabled: boolean;
  url: string;
}

export interface DatabaseConfig {
  influxdb: InfluxDBConfig;
  timescaledb: TimescaleDBConfig;
  redis: RedisConfig;
  keepJsonl: boolean;
}

/**
 * Load database configuration from environment variables
 */
export function loadDatabaseConfig(): DatabaseConfig {
  return {
    influxdb: {
      enabled: process.env.INFLUXDB_ENABLED !== 'false',
      url: process.env.INFLUXDB_URL || 'http://localhost:8086',
      token: process.env.INFLUXDB_TOKEN || 'desktop-agent-token-123',
      org: process.env.INFLUXDB_ORG || 'desktop-agent',
      bucket: process.env.INFLUXDB_BUCKET || 'file-access',
    },
    timescaledb: {
      enabled: process.env.TIMESCALEDB_ENABLED !== 'false',
      connectionString: process.env.TIMESCALEDB_URL || 
        'postgresql://desktopagent:desktopagent123@localhost:5432/desktop_agent',
    },
    redis: {
      enabled: process.env.REDIS_ENABLED !== 'false',
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    },
    keepJsonl: process.env.KEEP_JSONL !== 'false',
  };
}

