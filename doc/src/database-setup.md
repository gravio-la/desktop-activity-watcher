# Database Integration Setup Guide

This guide explains how to set up and use the database integration for the Desktop Agent daemon.

## Architecture

The daemon now writes events to three time series databases:
- **InfluxDB** - High-performance time series database
- **TimescaleDB** - PostgreSQL with time series extensions
- **Redis** - In-memory database with time series support

All three databases can be enabled/disabled independently via environment variables.

## Quick Start

### 1. Install Dependencies

```bash
cd daemon
bun install
```

This will install:
- `zod` - Schema validation
- `@influxdata/influxdb-client` - InfluxDB client
- `pg` - PostgreSQL/TimescaleDB client
- `redis` - Redis client

### 2. Start Databases

```bash
# From project root
docker-compose up -d

# Verify they're running
docker-compose ps
```

You should see all three containers healthy:
- `desktop-agent-influxdb` (port 8086)
- `desktop-agent-timescaledb` (port 5432)
- `desktop-agent-redis` (port 6379)

### 3. Run the Daemon

```bash
cd daemon

# First time or if you get permission errors, clean up old log files:
sudo rm -f /tmp/desktop-agent-events.jsonl

# Then start the daemon
sudo -E bun run start
```

The `-E` flag preserves environment variables.

**Note**: If the JSONL file exists with wrong permissions, the daemon will gracefully disable JSONL logging and continue with database-only storage.

## Configuration

All databases are enabled by default. Configure using environment variables:

### Enable/Disable Databases

```bash
# Disable specific databases
export INFLUXDB_ENABLED=false
export TIMESCALEDB_ENABLED=false
export REDIS_ENABLED=false

# Keep JSONL logging (default: true)
export KEEP_JSONL=true
```

### Custom Connection Strings

```bash
# InfluxDB (defaults shown)
export INFLUXDB_URL=http://localhost:8086
export INFLUXDB_TOKEN=desktop-agent-token-123
export INFLUXDB_ORG=desktop-agent
export INFLUXDB_BUCKET=file-access

# TimescaleDB (default shown)
export TIMESCALEDB_URL=postgresql://desktopagent:desktopagent123@localhost:5432/desktop_agent

# Redis (default shown)
export REDIS_URL=redis://localhost:6379

# JSONL backup file (default shown)
export LOG_FILE=/tmp/desktop-agent-events.jsonl
```

## Verifying Data

### InfluxDB

Using the InfluxDB UI:
```bash
# Open in browser
firefox http://localhost:8086

# Login credentials
Username: admin
Password: adminpass123
```

Or use the CLI:
```bash
curl -XPOST 'http://localhost:8086/api/v2/query?org=desktop-agent' \
  -H 'Authorization: Token desktop-agent-token-123' \
  -H 'Content-Type: application/vnd.flux' \
  --data 'from(bucket:"file-access") |> range(start: -1h) |> limit(n: 10)'
```

### TimescaleDB

```bash
# Connect to database
psql -h localhost -U desktopagent -d desktop_agent

# Password: desktopagent123

# Query recent events
SELECT 
  time, 
  event_type, 
  event_data->>'pid' as pid,
  event_data 
FROM desktop_agent_events 
ORDER BY time DESC 
LIMIT 10;

# Count events by type
SELECT 
  event_type, 
  COUNT(*) 
FROM desktop_agent_events 
GROUP BY event_type;
```

### Redis

```bash
# Connect to Redis
redis-cli

# List event keys
KEYS desktop_agent:*

# Get timeline for window events
ZRANGE desktop_agent:events:window_activated:timeline 0 10

# Get specific event
GET desktop_agent:events:window_activated:1699276345234
```

## Schema Details

All events are validated using Zod schemas before being written to databases.

### Event Types

1. **Window Event** (`window_activated`)
   - Window title, application, PID
   - Geometry (x, y, width, height)
   - Desktop, screen, activities

2. **File Event** (`file_accessed`)
   - File path, operation (open/read/write/close)
   - Process name, PID, UID
   - File descriptor, flags

3. **Correlated Event** (`correlated`)
   - Active window information
   - File access information
   - Links window and file activity by PID

## Database Schemas

### InfluxDB

Events are stored as measurements with tags and fields:

**Measurements:**
- `window_event` - Window activation events
- `file_event` - File access events
- `correlated_event` - Correlated events

**Common tags:**
- `source` - Always "desktop-agent"
- `event_type` - Event type discriminator
- `application` - Application name
- `process_name` - Process name
- `operation` - File operation

### TimescaleDB

Single hypertable: `desktop_agent_events`

**Columns:**
- `time` (TIMESTAMPTZ) - Event timestamp
- `event_type` (TEXT) - Event type
- `event_data` (JSONB) - Full event data

**Indexes:**
- `idx_event_type` - For type-based queries
- `idx_event_data_pid` - For PID-based queries

### Redis

**Key patterns:**
- `desktop_agent:events:<type>:<timestamp>` - Individual events
- `desktop_agent:events:<type>:timeline` - Sorted sets for time-based queries

Events auto-expire after 30 days. Timelines keep last 10,000 entries.

## Troubleshooting

### Permission Errors on Startup

**Error**: `EACCES: permission denied, open /tmp/desktop-agent-events.jsonl`

**Cause**: The JSONL log file exists with wrong ownership (usually owned by your user, but daemon runs as root)

**Solution**:
```bash
# Remove the old log file
sudo rm -f /tmp/desktop-agent-events.jsonl

# Or disable JSONL logging entirely
export KEEP_JSONL=false
sudo -E bun run start
```

The daemon now gracefully handles this error and will continue with database-only storage if the JSONL file can't be opened.

### Connection Errors

If you see connection errors:

```bash
# Check database status
docker-compose ps

# View logs
docker-compose logs influxdb
docker-compose logs timescaledb
docker-compose logs redis

# Restart databases
docker-compose restart
```

### Validation Errors

Events that fail Zod validation are logged but not written. Check daemon logs:

```bash
# Watch daemon output
sudo -E bun run start | grep "validation"
```

### Database-Specific Errors

The daemon logs errors per database but continues running. Check logs for:
- `InfluxDB: Write failed`
- `TimescaleDB: Write failed`
- `Redis: Write failed`

## Performance Tuning

### Batching (Future Enhancement)

Currently, events are written immediately. For high-volume scenarios, consider:
- Batching writes (collect N events before writing)
- Async queue with worker threads
- Circuit breaker for failing databases

### Disable Unused Databases

Disable databases you don't need:

```bash
# Only use InfluxDB
export TIMESCALEDB_ENABLED=false
export REDIS_ENABLED=false
```

### JSONL Backup

Disable JSONL if you only need database storage:

```bash
export KEEP_JSONL=false
```

## Architecture Benefits

✅ **Type Safety** - Zod schemas with TypeScript inference  
✅ **Extensible** - Easy to add new databases via adapter pattern  
✅ **Resilient** - Database errors don't crash the daemon  
✅ **Configurable** - Enable/disable databases independently  
✅ **Validated** - All events validated before writing  

## Next Steps

Consider adding:
- Batch writes for better performance
- Retry logic for transient failures
- Circuit breaker for failing databases
- Metrics/monitoring endpoint
- Data retention policies
- Query API for retrieving events

---

**Created**: 2025-11-06  
**Status**: ✅ Fully Implemented

