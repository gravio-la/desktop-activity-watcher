# Desktop Agent Prototype

A prototype desktop agent that tracks window focus, process activity, and file access using KWin JavaScript scripting and eBPF for Linux systems. The system stores events in time series databases for analysis and building a "heatmap" of file relevance.

## Architecture

### Components

1. **KWin Script** (`kwin-scripts/window-tracker/`)
   - JavaScript script that runs within KDE Plasma's KWin
   - Tracks window activation events
   - Logs process information, window titles, and PIDs

2. **File Monitor** (`file-monitor/`)
   - Rust application with eBPF integration
   - Monitors file read/write operations in home directory
   - Tracks which processes access which files

3. **Database Adapters** (`db-adapters/`)
   - Abstraction layer for time series databases
   - Implementations for InfluxDB, TimescaleDB, and Redis
   - Common trait interface for easy switching

4. **Time Series Databases** (Docker Compose)
   - **InfluxDB**: Purpose-built time series database
   - **TimescaleDB**: PostgreSQL with time series extensions
   - **Redis with RedisTimeSeries**: In-memory with persistence

## Getting Started

### Prerequisites

- Nix with flakes enabled
- Docker and Docker Compose  
- Linux kernel with eBPF support (5.4+) and BCC tools
- KDE Plasma desktop environment (for KWin script)
- Bun runtime (included in Nix shell)

### Setup

1. **Enter development environment:**

```bash
cd /path/to/ebpf-experiments
nix develop
```

2. **Start databases:**

```bash
docker-compose up -d
```

3. **Check database status:**

```bash
db-status
```

### Building

#### Database Adapters Library

```bash
cd db-adapters
cargo build --release
```

#### File Monitor

```bash
cd file-monitor
cargo build --release
```

### Running

#### TypeScript Daemon (Recommended)

The simplest way to run the complete system:

```bash
# 1. Deploy KWin script (if not already running)
./scripts/run-kwin-script.sh

# 2. Start the unified daemon (combines window + file tracking)
cd daemon
sudo bun run start

# Or in development mode with auto-reload
sudo bun run dev
```

The daemon will:
- Monitor window focus changes from KWin
- Track file access in home directory via opensnoop
- Correlate events (which app accessed which file)
- Log everything with nice formatting
- Write JSONL to `/tmp/desktop-agent-events.jsonl`

See `daemon/README.md` for more details.

#### Individual Components

You can also run components separately:

##### Deploy KWin Script

```bash
kwin-script-runner
```

Then enable the script in System Settings:
- Open System Settings > Window Management > KWin Scripts
- Enable "Window Activity Tracker"
- Apply changes

Or use command line:
```bash
kwriteconfig5 --file kwinrc --group Plugins --key window-trackerEnabled true
qdbus org.kde.KWin /KWin reconfigure
```

View KWin script output:
```bash
journalctl -f | grep kwin
```

#### Run File Monitor

The file monitor requires root privileges for eBPF:

```bash
# Using InfluxDB (default)
sudo DB_TYPE=influxdb file-monitor-runner

# Using TimescaleDB
sudo DB_TYPE=timescaledb file-monitor-runner

# Using Redis
sudo DB_TYPE=redis file-monitor-runner

# Dry run (no database writes)
sudo file-monitor-runner --dry-run --verbose
```

### Configuration

The system uses environment variables for configuration:

#### InfluxDB
```bash
export DB_TYPE=influxdb
export INFLUXDB_URL=http://localhost:8086
export INFLUXDB_ORG=desktop-agent
export INFLUXDB_BUCKET=file-access
export INFLUXDB_TOKEN=desktop-agent-token-123
```

#### TimescaleDB
```bash
export DB_TYPE=timescaledb
export TIMESCALEDB_HOST=localhost
export TIMESCALEDB_PORT=5432
export TIMESCALEDB_DATABASE=desktop_agent
export TIMESCALEDB_USER=desktopagent
export TIMESCALEDB_PASSWORD=desktopagent123
```

#### Redis
```bash
export DB_TYPE=redis
export REDIS_URL=redis://localhost:6379
export REDIS_KEY_PREFIX=desktop_agent:
```

## Database Access

### InfluxDB

Web UI: http://localhost:8086
- Username: `admin`
- Password: `adminpass123`
- Organization: `desktop-agent`
- Bucket: `file-access`

Query example (Flux):
```flux
from(bucket: "file-access")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "desktop_agent_event")
```

### TimescaleDB

Command line:
```bash
psql -h localhost -U desktopagent -d desktop_agent
```

Query example (SQL):
```sql
SELECT time, event_type, file_path, process_name
FROM desktop_agent_events
WHERE time > NOW() - INTERVAL '1 hour'
ORDER BY time DESC
LIMIT 100;
```

### Redis

Command line:
```bash
redis-cli
```

Query examples:
```redis
# Get recent events
ZREVRANGE desktop_agent:events:timeline 0 99

# Get file access count
GET desktop_agent:file_count:/home/user/document.txt

# Get event details
HGETALL event:uuid-here
```

## Development

### eBPF Implementation Status

⚠️ **Note**: The eBPF program is currently a placeholder. To implement proper file monitoring:

1. Generate `vmlinux.h` for your kernel:
```bash
bpftool btf dump file /sys/kernel/btf/vmlinux format c > file-monitor/src/bpf/vmlinux.h
```

2. Implement BPF hooks in `file-monitor/src/bpf/file_monitor.bpf.c`
3. Use tracepoints or kprobes for:
   - `sys_enter_openat` / `sys_exit_openat`
   - `sys_enter_read` / `sys_exit_read`
   - `sys_enter_write` / `sys_exit_write`
   - `sys_enter_close` / `sys_exit_close`

4. Implement userspace BPF loader in `file-monitor/src/bpf_loader.rs`

### Testing

```bash
# Test database adapters
cd db-adapters
cargo test

# Run file monitor in verbose mode
sudo file-monitor-runner --verbose --dry-run
```

### Performance Testing

The goal is to compare write and read performance across the three databases:

1. **Write Performance**: Event ingestion rate
2. **Read Performance**: Query response time for common patterns
3. **Storage Efficiency**: Disk space usage over time
4. **Query Flexibility**: Ease of implementing complex queries

## Project Structure

```
ebpf-experiments/
├── docker-compose.yml          # Database services
├── flake.nix                   # Nix development environment
├── .gitignore                  # Git ignore rules
├── README.md                   # This file
│
├── kwin-scripts/               # KWin window tracker
│   └── window-tracker/
│       ├── metadata.json       # KWin script metadata
│       └── contents/code/
│           └── main.js         # Window tracking script
│
├── file-monitor/               # eBPF file monitoring
│   ├── Cargo.toml             # Rust dependencies
│   ├── build.rs               # BPF build script
│   └── src/
│       ├── main.rs            # Application entry point
│       ├── events.rs          # Event structures
│       ├── bpf_loader.rs      # BPF loading logic
│       └── bpf/
│           └── file_monitor.bpf.c  # eBPF program (placeholder)
│
├── db-adapters/               # Database abstraction layer
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs             # Library entry point
│       ├── models.rs          # Data models
│       ├── traits.rs          # Adapter trait
│       ├── config.rs          # Configuration
│       ├── influxdb.rs        # InfluxDB implementation
│       ├── timescaledb.rs     # TimescaleDB implementation
│       └── redis_ts.rs        # Redis implementation
│
└── data/                      # Database data (gitignored)
    ├── influxdb/
    ├── timescaledb/
    └── redis/
```

## Use Cases

### File Access Heatmap

Generate a list of most frequently accessed files:

```rust
use db_adapters::{QueryParams, TimeSeriesAdapter};

let params = QueryParams {
    start_time: Utc::now() - chrono::Duration::hours(24),
    end_time: Utc::now(),
    ..Default::default()
};

let heatmap = adapter.get_access_heatmap(&params).await?;
for (file_path, count) in heatmap.iter().take(10) {
    println!("{}: {} accesses", file_path, count);
}
```

### Context-Aware File Assistant

Determine relevant files based on:
- Currently active window/application
- Recent file access patterns
- Time-based context (working hours, projects)

### Backup Prioritization

Identify files that:
- Are frequently modified
- Haven't been backed up recently
- Are accessed by critical applications

### Development Analytics

Track:
- Which files are accessed together (co-occurrence)
- Project context switching patterns
- Development workflow insights

## Roadmap

- [ ] Complete eBPF implementation for file monitoring
- [ ] Add process lifecycle tracking (start/exit events)
- [ ] Implement KWin ↔ file-monitor communication (correlate window context with file access)
- [ ] Add vector database integration for semantic file search
- [ ] Build web dashboard for visualization
- [ ] Implement privacy controls and filtering
- [ ] Add machine learning for context prediction
- [ ] Create file recommendation engine

## License

This is a prototype/experimental project. License TBD.

## Security & Privacy

⚠️ **Important**: This system tracks file access and window activity. Ensure you:

- Only use on systems you own
- Implement proper access controls for database data
- Consider privacy implications of tracking
- Add filtering for sensitive directories/files
- Secure database connections in production

## Troubleshooting

### eBPF Issues

**Error: Failed to load BPF program**
- Ensure you have root/CAP_BPF privileges
- Check kernel version: `uname -r` (need 5.4+)
- Verify BPF is enabled: `zgrep BPF /proc/config.gz`

**Error: Cannot find vmlinux.h**
- Generate it: `bpftool btf dump file /sys/kernel/btf/vmlinux format c > vmlinux.h`

### Database Connection Issues

**InfluxDB connection refused**
- Check container: `docker ps | grep influxdb`
- View logs: `docker logs desktop-agent-influxdb`
- Verify port: `netstat -tlnp | grep 8086`

**TimescaleDB connection timeout**
- Check PostgreSQL: `docker exec -it desktop-agent-timescaledb pg_isready`
- Test connection: `psql -h localhost -U desktopagent -d desktop_agent`

**Redis connection failed**
- Check container: `docker ps | grep redis`
- Test: `redis-cli ping`

### KWin Script Not Working

**Script doesn't load**
- Check installation: `ls ~/.local/share/kwin/scripts/window-tracker/`
- View KWin logs: `journalctl -xe | grep kwin`
- Try manual load: `qdbus org.kde.KWin /Scripting loadScript window-tracker`

**No events logged**
- Ensure script is enabled in System Settings
- Check for JavaScript errors in logs
- Verify KWin version compatibility (KDE Plasma 5.x/6.x)

## Contributing

This is currently an experimental prototype. Contributions, ideas, and feedback are welcome!

## Related Projects

- [Baloo](https://community.kde.org/Baloo) - KDE's file indexing system
- [bpftrace](https://github.com/iovisor/bpftrace) - High-level eBPF tracing
- [opensnoop](https://github.com/brendangregg/perf-tools) - File open tracking
- [ActivityWatch](https://activitywatch.net/) - Automated time tracking

