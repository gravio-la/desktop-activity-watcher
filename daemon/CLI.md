# Desktop Agent CLI

Command-line interface for querying events from the Desktop Agent databases.

## Installation

The CLI is included with the daemon. Dependencies are automatically installed:

```bash
cd daemon
bun install
```

## Usage

```bash
bun run cli <command> [options]
```

## Commands

### `list` - List Events

Query and display events from the databases.

**Basic usage:**
```bash
# List last 20 events from all databases
bun run cli list

# List events from the last 5 minutes
bun run cli list --since 5m

# List only file access events
bun run cli list --type file

# List window events from the last hour
bun run cli list --type window --since 1h

# List correlated events
bun run cli list --type correlated --since 30m

# Query specific database only
bun run cli list --database timescaledb --since 10m

# Limit number of results
bun run cli list --limit 50 --since 2h
```

**Options:**
- `-t, --type <type>` - Filter by event type: `window`, `file`, or `correlated`
- `-s, --since <duration>` - Time range: `5m`, `1h`, `2d`, etc.
  - `s` = seconds
  - `m` = minutes
  - `h` = hours
  - `d` = days
- `-l, --limit <number>` - Maximum number of events (default: 20)
- `-d, --database <name>` - Query specific database: `influxdb`, `timescaledb`, `redis`, or `all` (default: all)

### `stats` - Show Statistics

Display event statistics and counts by type.

```bash
# Show stats for the last hour
bun run cli stats

# Show stats for the last 24 hours
bun run cli stats --since 24h

# Show stats for the last week
bun run cli stats --since 7d
```

**Options:**
- `-s, --since <duration>` - Time range (default: 1h)

## Examples

### Query Recent File Access Events

```bash
bun run cli list --type file --since 5m --limit 10
```

**Output:**
```
🔍 Querying databases...
   Type: file_accessed
   Since: 2025-11-06T13:00:00.000Z
   Limit: 10

📊 InfluxDB Results:
────────────────────────────────────────────────────────────────────────────────
1. [2025-11-06T13:05:15.123Z] file_accessed
   {
     "filePath": "~/.config/Cursor/User/settings.json",
     "operation": "open",
     "processName": "cursor",
     "pid": 6695
   }
2. [2025-11-06T13:04:30.456Z] file_accessed
   ...
   Total: 10 events
```

### Query All Events from TimescaleDB Only

```bash
bun run cli list --database timescaledb --since 1h
```

### Show Event Statistics

```bash
bun run cli stats --since 1h
```

**Output:**
```
📊 Event Statistics (since 2025-11-06T13:00:00.000Z)

🐘 TimescaleDB:
   Total events: 145
   - window_activated: 12
   - file_accessed: 130
   - correlated: 3
```

## Event Types

The databases store three types of events:

### 1. Window Events (`window`)
Window activation/focus changes from KWin.

**Fields:**
- `windowTitle` - Title of the window
- `resourceClass` - Application class
- `pid` - Process ID
- `geometry` - Window position and size
- And more...

### 2. File Events (`file`)
File access events from eBPF/opensnoop.

**Fields:**
- `filePath` - Path to the accessed file
- `operation` - Type: open, read, write, close
- `processName` - Name of the process
- `pid` - Process ID
- `uid` - User ID

### 3. Correlated Events (`correlated`)
Combined window + file access events (when PID matches).

**Fields:**
- `activeWindow` - Window information
- `fileAccess` - File access information

## Database-Specific Behavior

Each database stores events differently:

### InfluxDB
- Stores events as time series measurements
- Separate measurements: `window_event`, `file_event`, `correlated_event`
- Fields are stored as tags and fields

### TimescaleDB
- Stores events in a hypertable: `desktop_agent_events`
- Single table with JSONB data column
- Most flexible for complex queries

### Redis
- Stores events as JSON with sorted sets
- Keys: `desktop_agent:events:<type>:<timestamp>`
- Timelines: `desktop_agent:events:<type>:timeline`
- 30-day TTL

## Configuration

The CLI uses the same configuration as the daemon:

```bash
# Use custom database URLs
export INFLUXDB_URL=http://localhost:8086
export TIMESCALEDB_URL=postgresql://user:pass@localhost:5432/db
export REDIS_URL=redis://localhost:6379

# Then run CLI
bun run cli list
```

## Tips

1. **Start with stats** to see what data you have:
   ```bash
   bun run cli stats --since 24h
   ```

2. **Query specific database** for faster results:
   ```bash
   bun run cli list --database timescaledb --since 5m
   ```

3. **Use short time ranges** for recent activity:
   ```bash
   bun run cli list --since 1m
   ```

4. **Filter by type** to find specific events:
   ```bash
   bun run cli list --type window --since 1h
   ```

5. **Increase limit** for bulk exports:
   ```bash
   bun run cli list --limit 1000 --since 24h > events.json
   ```

## Troubleshooting

### "No events found"

- Check that the daemon is running and writing events
- Try a longer time range: `--since 24h`
- Check database connections:
  ```bash
  bun run verify-databases.ts
  ```

### Connection Errors

- Ensure databases are running: `docker-compose ps`
- Check configuration environment variables
- Verify network connectivity to databases

### Empty Results from Specific Database

- Check if that database is enabled in config
- Query another database to verify events exist
- Check database logs: `docker-compose logs <database>`

## Advanced Usage

### Export to JSON

```bash
bun run cli list --since 1h --limit 1000 > events.json
```

### Query Multiple Times

```bash
# Compare different time windows
bun run cli list --since 5m --limit 10
bun run cli list --since 1h --limit 10
bun run cli list --since 24h --limit 10
```

### Filter and Process with jq

```bash
# Extract just file paths
bun run cli list --type file --since 1h --database timescaledb | \
  grep -o '\"filePath\": \"[^\"]*\"' | \
  cut -d'"' -f4 | \
  sort | uniq
```

---

**Version**: 0.1.0  
**Dependencies**: cmd-ts, date-fns, database clients

