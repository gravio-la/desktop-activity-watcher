# Desktop Agent Daemon (TypeScript/Bun)

A TypeScript daemon using Bun that combines window focus tracking with file access monitoring.

## Features

- 🪟 **Window Tracking**: Monitors KWin for window focus changes via journalctl
- 📂 **File Monitoring**: Uses opensnoop to track file access in home directory  
- 🔗 **Event Correlation**: Correlates file access with active window
- 📝 **Unified Logging**: JSONL output for database ingestion
- 🎨 **Pretty Console**: Colored, formatted console output

## Prerequisites

```bash
# Enter Nix dev shell (provides all dependencies)
nix develop

# Or install manually:
# - Bun runtime
# - opensnoop (from bpfcc-tools)
# - Running KWin with window-tracker script
```

## Installation

```bash
cd daemon
bun install
```

## Usage

### Start the daemon

```bash
# Must run as root for opensnoop
# Use -E to preserve environment variables (IMPORTANT!)
sudo -E bun run start

# Or use the helper script
sudo -E ./run.sh

# Or in development mode (with auto-reload)
sudo -E bun run dev
```

**⚠️ Important**: Always use `sudo -E` (not just `sudo`)!

The `-E` flag preserves your environment variables, which is critical for:
- Detecting your real username (`SUDO_USER`)
- Accessing your home directory (`HOME`)
- Connecting to your user's systemd journal

### Configuration

Environment variables:

```bash
HOME=/home/username        # Home directory to monitor (default: $HOME)
LOG_FILE=/tmp/events.jsonl # Event log file (default: /tmp/desktop-agent-events.jsonl)
LOG_LEVEL=debug            # Logging level: debug, info, warn, error
```

Example:

```bash
sudo LOG_LEVEL=debug HOME=/home/average-joe bun run start
```

## Output

### Console Output

Pretty formatted logs with colors and timestamps:

```
[13:45:23.123] 🚀 Desktop Agent Daemon starting...
[13:45:23.456] 🎯 Starting window tracker...
[13:45:23.789] 📂 Starting file monitor...
[13:45:24.012] ✅ Desktop Agent Daemon is running
[13:45:25.234] 🪟  Switched to: Cursor [Cursor] (PID: 6695)
[13:45:26.456] 📂 File access: /home/average-joe/document.txt by cursor (PID: 6695)
[13:45:26.457] 🔗 Correlated: Cursor accessed /home/average-joe/document.txt
```

### JSONL Log File

Each line is a JSON event:

```json
{"type":"window_activated","timestamp":"2025-11-06T13:45:25.234Z","windowTitle":"Cursor","resourceClass":"Cursor","pid":6695,...}
{"type":"file_accessed","timestamp":"2025-11-06T13:45:26.456Z","operation":"open","filePath":"/home/average-joe/document.txt","processName":"cursor","pid":6695,...}
{"type":"correlated","timestamp":"2025-11-06T13:45:26.457Z","activeWindow":{...},"fileAccess":{...}}
```

## Architecture

```
┌─────────────────┐
│  WindowTracker  │──────┐
└─────────────────┘      │
                         ▼
                  ┌─────────────┐      ┌──────────┐
                  │ Correlator  │─────▶│ Log File │
                  └─────────────┘      └──────────┘
                         ▲
┌─────────────────┐      │
│  FileMonitor    │──────┘
└─────────────────┘
```

### Components

- **WindowTracker**: Monitors journalctl for KWin events, parses JSON, logs window switches
- **FileMonitor**: Runs opensnoop, filters for home directory, logs file access
- **EventCorrelator**: Receives events from both, correlates by PID, writes to log file

## Development

```bash
# Type checking
bun run check

# Run with debug logging
sudo LOG_LEVEL=debug bun run dev

# View logs in another terminal
tail -f /tmp/desktop-agent-events.jsonl | jq
```

## Future Enhancements

- [ ] Database integration (InfluxDB, TimescaleDB, Redis)
- [ ] Web dashboard for visualization
- [ ] Advanced correlation (file → window history)
- [ ] Process lifecycle tracking
- [ ] Configuration file support
- [ ] Systemd service integration
- [ ] Performance metrics
- [ ] File access heatmap generation

## Troubleshooting

### "opensnoop not found"

```bash
# Make sure you're in the Nix dev shell
nix develop

# Or install bpfcc-tools
sudo apt install bpfcc-tools
```

### "Permission denied" errors

opensnoop requires root, but you MUST use `-E`:

```bash
sudo -E bun run start
```

Without `-E`, the daemon won't be able to access your user's journal for window events.

### No window events

Make sure the KWin script is running:

```bash
./scripts/run-kwin-script.sh
```

Check if events are being logged:

```bash
journalctl --user -f -u plasma-kwin_wayland.service | grep 'Window Activity Tracker'
```

## License

Part of the Desktop Agent prototype project.

