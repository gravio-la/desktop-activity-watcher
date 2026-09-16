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

export function buildTimescaleConnectionString(): string {
  if (process.env.TIMESCALEDB_URL) {
    return process.env.TIMESCALEDB_URL;
  }

  const host = process.env.TIMESCALEDB_HOST || 'localhost';
  const port = process.env.TIMESCALEDB_PORT || '5432';
  const database = process.env.TIMESCALEDB_DATABASE || 'desktop_agent';
  const user = process.env.TIMESCALEDB_USER || 'desktopagent';
  const password = process.env.TIMESCALEDB_PASSWORD || 'desktopagent123';

  // Unix socket path (no password) vs TCP host
  if (host.startsWith('/')) {
    return `postgresql:///${database}?host=${encodeURIComponent(host)}&port=${port}`;
  }

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

/**
 * Load database configuration from environment variables
 */
export function loadDatabaseConfig(): DatabaseConfig {
  return {
    influxdb: {
      enabled: process.env.INFLUXDB_ENABLED === 'true',
      url: process.env.INFLUXDB_URL || 'http://localhost:8086',
      token: process.env.INFLUXDB_TOKEN || 'desktop-agent-token-123',
      org: process.env.INFLUXDB_ORG || 'desktop-agent',
      bucket: process.env.INFLUXDB_BUCKET || 'file-access',
    },
    timescaledb: {
      enabled: process.env.TIMESCALEDB_ENABLED === 'true',
      connectionString: buildTimescaleConnectionString(),
    },
    redis: {
      enabled: process.env.REDIS_ENABLED === 'true',
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    },
    keepJsonl: process.env.KEEP_JSONL === 'true',
  };
}
