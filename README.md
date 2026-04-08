# Desktop Agent Prototype

A prototype desktop agent that tracks window focus, process activity, and file access using KWin JavaScript scripting and eBPF for Linux systems. The system stores events in time series databases for analysis and building a "heatmap" of file relevance.

### About this prototype

This work was carried out **in cooperation with an AI agent** as a way to **test an idea**, not as a finished product: combine lightweight desktop telemetry (which window is active, which processes open which paths) with a **time-series record of file usage** so “what you touched recently” is queryable data, not only a mental model.

**Concept in short:** treat **recent file access as a temporal stream**—ordered events with timestamps (and, where possible, correlation to the active application). That complements traditional **file indexing**, which answers “what exists and where,” with “what is *hot* right now and how attention moved over the last minutes or hours.”

**Why that can matter:**

- **File indexing:** indexers and crawlers can prioritize **refresh, deduplication, and scheduling** using recency and frequency instead of treating every path equally. Cold paths stay indexed; hot paths get fresher metadata when it matters.
- **Context detection:** sequences and co-occurrences of opens (often with window or app identity) help infer **current task or project** without reading file contents—useful for automation, summaries, or “resume where I left off” behavior.
- **Modern assistants:** local or hybrid assistants (IDE tools, retrieval-augmented chat, coding agents) need **small, relevant context windows**. A recent-usage timeline is a strong, privacy-conscious signal for which files and folders to surface or embed—alongside classical search—so answers stay grounded in what the user is actually working with.

## Documentation (mdBook)

User and deployment guides live as an **[mdBook](https://rust-lang.github.io/mdBook/)** under [`doc/`](./doc/): configuration is in [`doc/book.toml`](./doc/book.toml); chapters are in [`doc/src/`](./doc/src/).

- **Build locally:** `nix build .#book` (HTML in the Nix store) or `cd doc && mdbook build` / `mdbook serve` (after `nix develop`).
- **GitHub Pages:** the workflow [`.github/workflows/mdbook-pages.yml`](./.github/workflows/mdbook-pages.yml) builds with Nix and deploys on pushes to `main` or `master`. In the repository **Settings → Pages**, set the source to **GitHub Actions**. The book is published at **[https://gravio-la.github.io/desktop-activity-watcher/](https://gravio-la.github.io/desktop-activity-watcher/)** (see [`site-url`](https://rust-lang.github.io/mdBook/format/configuration.html#html-renderer-options) in [`doc/book.toml`](./doc/book.toml)).

## 🚀 Quick Start with Home Manager

The easiest way to use the Desktop Agent is through the provided Home Manager module.

### Prerequisites

- NixOS or Nix with Home Manager
- KDE Plasma desktop environment
- Docker for databases (optional, can use system services)

### Installation

1. **Add to your flake inputs** (`flake.nix`):

```nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    home-manager.url = "github:nix-community/home-manager";
    
    desktop-agent.url = "github:gravio-la/desktop-activity-watcher";
    # Or a local checkout: desktop-agent.url = "path:/path/to/desktop-activity-watcher";
  };
}
```

2. **Import the module** in your Home Manager configuration:

```nix
homeConfigurations.yourusername = home-manager.lib.homeManagerConfiguration {
  modules = [
    ./home.nix
    desktop-agent.homeManagerModules.desktopAgent
  ];
};
```

3. **Configure in `home.nix`**:

```nix
services.desktopAgent = {
  enable = true;
  
  databases.influxdb = {
    enable = true;
    url = "http://localhost:8086";
    token = "your-token";
  };
};
```

4. **Apply the configuration**:

```bash
home-manager switch
```

**📖 For detailed configuration options, see the [Home Manager module chapter](./doc/src/home-manager-module.md)** (or the rendered book after `nix build .#book` / GitHub Pages).

**💡 For a complete example, see [example-home.nix](./example-home.nix)**

## Architecture

### Components

1. **KWin Script** (`kwin-scripts/window-tracker/`)
   - JavaScript script that runs within KDE Plasma's KWin
   - Tracks window activation events
   - Logs process information, window titles, and PIDs

2. **TypeScript Daemon** (`daemon/`)
   - Bun-based daemon that processes events
   - Monitors file access via opensnoop (eBPF)
   - Correlates window and file events
   - Supports multiple database backends

3. **Time Series Databases** (Docker Compose)
   - **InfluxDB**: Purpose-built time series database
   - **TimescaleDB**: PostgreSQL with time series extensions
   - **JSONL**: Simple line-delimited JSON files

## Manual Setup (Alternative)

If you prefer not to use Home Manager, you can set up the components manually.

### Prerequisites

- Nix with flakes enabled
- Docker and Docker Compose  
- Linux kernel with eBPF support (5.4+) and BCC tools
- KDE Plasma desktop environment (for KWin script)
- Bun runtime (included in Nix shell)
- Permission to run eBPF tools (see configuration.nix setup below)

### System Configuration (Required)

Add to your `configuration.nix` to allow the daemon to run `opensnoop` without password:

```nix
# configuration.nix
{
  security.sudo.extraRules = [
    {
      users = [ "yourusername" ];  # Replace with your username!
      commands = [
        {
          command = "${pkgs.linuxPackages.bcc}/bin/opensnoop";
          options = [ "NOPASSWD" ];
        }
      ];
    }
  ];
}
```

Rebuild your system: `sudo nixos-rebuild switch`

**See [Sudo configuration](./doc/src/sudo-configuration.md) for detailed information.**

### Setup

1. **Clone or download this repository**

The daemon runs from the source directory, so you need the repository available.

2. **Install daemon dependencies:**

```bash
cd /path/to/desktop-activity-watcher/daemon
bun install
```

> **Important**: The daemon is not pre-built. Dependencies must be installed before first use.

3. **Start databases (optional):**

```bash
cd /path/to/desktop-activity-watcher
docker-compose up -d
```

### Running the Daemon

#### TypeScript Daemon

The daemon combines window tracking and file monitoring:

```bash
# 1. Deploy KWin script
./scripts/run-kwin-script.sh

# 2. Copy example config
cd daemon
cp config.example.json config.json
# Edit config.json with your database settings

# 3. Start the daemon (requires eBPF permissions)
bun run start

# Or in development mode with auto-reload
bun run dev
```

The daemon will:
- Monitor window focus changes from KWin (via journal logs)
- Track file access in home directory via opensnoop (eBPF)
- Correlate events (which app accessed which file)
- Log everything with nice formatting
- Write to configured databases

See `daemon/README.md` and `daemon/CLI.md` for more details.

#### Deploy KWin Script Manually

```bash
# Copy script to local directory
mkdir -p ~/.local/share/kwin/scripts/window-tracker
cp -r kwin-scripts/window-tracker/* ~/.local/share/kwin/scripts/window-tracker/

# Enable in KWin configuration
kwriteconfig6 --file kwinrc --group Plugins --key window-trackerEnabled true

# Restart KWin (choose based on your session)
kwin_x11 --replace &
# or
kwin_wayland --replace &
```

View KWin script output:
```bash
journalctl -f | grep -i "window activity tracker"
```

### Configuration (Manual Setup)

The daemon uses a JSON configuration file (`daemon/config.json`). See `daemon/config.example.json` for all options.

You can also provide database connection details via environment variables:

#### InfluxDB Environment Variables
```bash
export DB_TYPE=influxdb
export INFLUXDB_URL=http://localhost:8086
export INFLUXDB_ORG=desktop-agent
export INFLUXDB_BUCKET=file-access
export INFLUXDB_TOKEN=desktop-agent-token-123
```

#### TimescaleDB Environment Variables
```bash
export DB_TYPE=timescaledb
export TIMESCALEDB_HOST=localhost
export TIMESCALEDB_PORT=5432
export TIMESCALEDB_DATABASE=desktop_agent
export TIMESCALEDB_USER=desktopagent
export TIMESCALEDB_PASSWORD=desktopagent123
```

#### Redis Environment Variables (Optional)
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

Enter the development shell to work on the daemon or module:

```bash
cd /path/to/desktop-activity-watcher
nix develop
```

This provides:
- Bun runtime for daemon development
- eBPF tools (bpftrace, opensnoop) for file monitoring
- Database clients for testing
- All necessary development tools

### Testing the Daemon

```bash
cd daemon

# Run tests (if available)
bun test

# Run in development mode with live reload
bun run dev

# Test database connections
bun run verify-databases.ts
```

### Performance Testing

The goal is to compare write and read performance across the three databases:

1. **Write Performance**: Event ingestion rate
2. **Read Performance**: Query response time for common patterns
3. **Storage Efficiency**: Disk space usage over time
4. **Query Flexibility**: Ease of implementing complex queries

## Project Structure

```
desktop-activity-watcher/
├── flake.nix                      # Nix flake with Home Manager module + mdBook package (.#book)
├── doc/                           # mdBook documentation (book.toml, src/)
├── example-home.nix               # Example configuration
├── docker-compose.yml             # Database services (Docker)
├── README.md                      # This file
│
├── kwin-scripts/                  # KWin window tracker
│   └── window-tracker/
│       ├── metadata.json          # KWin script metadata
│       └── contents/code/
│           └── main.js            # Window tracking script
│
├── daemon/                        # TypeScript daemon (Bun)
│   ├── package.json               # Dependencies
│   ├── config.json                # Runtime configuration
│   ├── config.example.json        # Configuration template
│   ├── README.md                  # Daemon documentation
│   ├── CLI.md                     # CLI tool documentation
│   └── src/
│       ├── index.ts               # Entry point
│       ├── window-tracker.ts      # Window event processor
│       ├── file-monitor.ts        # File access tracker (opensnoop)
│       ├── correlator.ts          # Event correlation
│       └── database/              # Database adapters
│           ├── influxdb-adapter.ts
│           ├── timescaledb-adapter.ts
│           └── redis-adapter.ts
│
└── data/                          # Database data (gitignored)
    ├── influxdb/
    ├── timescaledb/
    └── redis/
```

## Use Cases

### File Access Heatmap

Generate a list of most frequently accessed files using the CLI:

```bash
desktop-agent-query files --top 10 --hours 24
```

Or query directly from the database (InfluxDB example):

```flux
from(bucket: "file-access")
  |> range(start: -24h)
  |> filter(fn: (r) => r._measurement == "file_access")
  |> group(columns: ["file_path"])
  |> count()
  |> top(n: 10)
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

- [x] KWin script for window tracking
- [x] File monitoring via opensnoop (eBPF)
- [x] Event correlation by PID
- [x] Multiple database backends (InfluxDB, TimescaleDB, JSONL)
- [x] Home Manager module for easy deployment
- [ ] Add process lifecycle tracking (start/exit events)
- [ ] Add vector database integration for semantic file search
- [ ] Build web dashboard for visualization
- [ ] Implement enhanced privacy controls and filtering
- [ ] Add machine learning for context prediction
- [ ] Create file recommendation engine
- [ ] Support for multiple desktop environments (GNOME, etc.)

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

### eBPF / opensnoop Issues

**Error: opensnoop: command not found**
- Ensure you're in the nix develop shell
- Check if BCC tools are available: `which opensnoop`
- Install BCC tools manually if needed

**Error: Permission denied when running opensnoop**
- Verify kernel sysctl setting: `sysctl kernel.unprivileged_bpf_disabled`
- Should be `0` - if not, add to your `configuration.nix`:
  ```nix
  boot.kernel.sysctl."kernel.unprivileged_bpf_disabled" = 0;
  ```
- Rebuild and reboot: `sudo nixos-rebuild switch && reboot`

**Daemon not capturing file events**
- Check if opensnoop is working: `opensnoop` (test manually)
- Verify monitored paths in config.json
- Check daemon logs: `desktop-agent-logs` or `journalctl --user -u desktop-agent`

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
- Verify files are present: `ls ~/.local/share/kwin/scripts/window-tracker/contents/code/main.js`
- View KWin logs: `journalctl -xe | grep -i kwin`

**Script not enabled**
- Check current setting:
  ```bash
  kreadconfig6 --file kwinrc --group Plugins --key window-trackerEnabled
  ```
- Enable manually:
  ```bash
  kwriteconfig6 --file kwinrc --group Plugins --key window-trackerEnabled true
  kwin_x11 --replace &  # or kwin_wayland --replace &
  ```
- Or enable in System Settings: Window Management → KWin Scripts

**No events logged**
- Check journal for script output:
  ```bash
  journalctl -f | grep -i "window activity tracker"
  ```
- Ensure script enabled (see above)
- Check for JavaScript errors in logs
- Test by switching between windows - should see events in journal
- Verify KWin version compatibility (tested with KDE Plasma 6.x)

## Contributing

This is currently an experimental prototype. Contributions, ideas, and feedback are welcome!

## Related Projects

- [Baloo](https://community.kde.org/Baloo) - KDE's file indexing system
- [bpftrace](https://github.com/iovisor/bpftrace) - High-level eBPF tracing
- [opensnoop](https://github.com/brendangregg/perf-tools) - File open tracking
- [ActivityWatch](https://activitywatch.net/) - Automated time tracking

