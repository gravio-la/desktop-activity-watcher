#!/usr/bin/env bun
/**
 * Database Connection Verification Script
 * 
 * Tests connectivity to all three databases
 */

import { loadDatabaseConfig } from './src/database/config';
import { InfluxDBAdapter } from './src/database/influxdb-adapter';
import { TimescaleDBAdapter } from './src/database/timescaledb-adapter';
import { RedisAdapter } from './src/database/redis-adapter';

async function verifyInfluxDB(config: any): Promise<boolean> {
  try {
    const adapter = new InfluxDBAdapter(config);
    await adapter.connect();
    console.log('✅ InfluxDB: Connected');
    await adapter.close();
    return true;
  } catch (error) {
    console.error('❌ InfluxDB: Connection failed:', error);
    return false;
  }
}

async function verifyTimescaleDB(config: any): Promise<boolean> {
  try {
    const adapter = new TimescaleDBAdapter(config);
    await adapter.connect();
    console.log('✅ TimescaleDB: Connected');
    await adapter.close();
    return true;
  } catch (error) {
    console.error('❌ TimescaleDB: Connection failed:', error);
    return false;
  }
}

async function verifyRedis(config: any): Promise<boolean> {
  try {
    const adapter = new RedisAdapter(config);
    await adapter.connect();
    console.log('✅ Redis: Connected');
    
    // Close with timeout for verification script
    const closePromise = adapter.close();
    const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 500));
    await Promise.race([closePromise, timeoutPromise]);
    
    return true;
  } catch (error) {
    console.error('❌ Redis: Connection failed:', error);
    return false;
  }
}

async function main() {
  console.log('🔍 Verifying database connections...\n');

  const config = loadDatabaseConfig();

  let allSuccess = true;

  if (config.influxdb.enabled) {
    console.log('Testing InfluxDB...');
    const success = await verifyInfluxDB(config.influxdb);
    allSuccess = allSuccess && success;
  } else {
    console.log('⏭️  InfluxDB: Disabled');
  }

  console.log();

  if (config.timescaledb.enabled) {
    console.log('Testing TimescaleDB...');
    const success = await verifyTimescaleDB(config.timescaledb);
    allSuccess = allSuccess && success;
  } else {
    console.log('⏭️  TimescaleDB: Disabled');
  }

  console.log();

  if (config.redis.enabled) {
    console.log('Testing Redis...');
    const success = await verifyRedis(config.redis);
    allSuccess = allSuccess && success;
  } else {
    console.log('⏭️  Redis: Disabled');
  }

  // Wait for any pending logs
  await new Promise(resolve => setTimeout(resolve, 100));
  
  console.log('\n' + '='.repeat(50));
  if (allSuccess) {
    console.log('✅ All enabled databases are accessible!');
    process.exit(0);
  } else {
    console.log('❌ Some database connections failed');
    console.log('   Run: docker-compose ps');
    console.log('   And: docker-compose logs');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

