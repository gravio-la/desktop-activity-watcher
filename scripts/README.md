# KWin Script Management Scripts

This directory contains scripts to deploy and manage the KWin Window Activity Tracker.

## Scripts

### 1. `deploy-kwin-script.sh`

Deploys or updates the KWin window tracker script.

**Usage:**
```bash
./scripts/deploy-kwin-script.sh
```

**What it does:**
- Creates backup of existing installation
- Copies script files to `~/.local/share/kwin/scripts/window-tracker/`
- Verifies installation
- Checks if KWin is running

**When to use:**
- Initial installation
- After modifying the script
- To restore from source

---

### 2. `run-kwin-script.sh`

Loads and runs the window tracker script using qdbus.

**Usage:**
```bash
./scripts/run-kwin-script.sh
```

**What it does:**
- Checks if script is installed
- Verifies KWin is running
- Loads script via qdbus
- Starts script execution
- Provides commands for monitoring

**When to use:**
- Start tracking after deployment
- Restart tracking after system reboot
- Reload after script changes

---

### 3. `capture-window-events.sh`

Captures window events from the journal and writes them to a JSONL file.

**Usage:**
```bash
# Capture events continuously (default)
./scripts/capture-window-events.sh

# Capture to custom file
OUTPUT_FILE=/tmp/my-events.jsonl ./scripts/capture-window-events.sh

# Capture historical events only (no follow)
FOLLOW=false ./scripts/capture-window-events.sh
```

**What it does:**
- Reads window events from journalctl
- Extracts JSON from log messages
- Writes to `/tmp/desktop-agent-window-events.jsonl`
- Shows capture statistics

**When to use:**
- When you need events in a file for processing
- To feed events to database adapters
- For batch analysis of window activity

---

## Quick Start

```bash
# 1. Deploy the script
./scripts/deploy-kwin-script.sh

# 2. Start tracking
./scripts/run-kwin-script.sh

# 3. Capture events to file (in another terminal)
./scripts/capture-window-events.sh

# 4. View the file
tail -f /tmp/desktop-agent-window-events.jsonl | jq

# Or view events in journal directly
journalctl --user -f -u plasma-kwin_wayland.service | grep 'Window Activity Tracker'
```

## Example Output

When the tracker is running, you'll see JSON events like this:

```json
{
  "event_type": "window_activated",
  "timestamp": "2025-11-06T12:49:56.363Z",
  "windowTitle": "main.js - Cursor",
  "resourceClass": "Cursor",
  "resourceName": "cursor",
  "pid": 6695,
  "windowId": 0,
  "desktop": -1,
  "screen": 0,
  "activities": ["a26eaa38-e53f-44a6-b150-da02635ce096"],
  "geometry": {
    "x": 0,
    "y": 2160,
    "width": 2021,
    "height": 1093
  }
}
```

## Management Commands

### Check if script is loaded
```bash
qdbus org.kde.KWin /Scripting isScriptLoaded window-tracker
```

### Stop the tracker
```bash
qdbus org.kde.KWin /Scripting unloadScript window-tracker
```

### List all loaded scripts
```bash
qdbus org.kde.KWin /Scripting
```

### View KWin logs
```bash
# Real-time monitoring
journalctl --user -f -u plasma-kwin_wayland.service

# Filter for tracker events only
journalctl --user -f -u plasma-kwin_wayland.service | grep 'Window Activity Tracker'

# View last 50 events
journalctl --user -u plasma-kwin_wayland.service -n 50 | grep 'Window Activity Tracker'
```

## Troubleshooting

### Script won't load
**Problem:** `KWin is not running or not accessible via DBus`

**Solution:**
- Make sure you're running KDE Plasma
- Check if KWin is running: `ps aux | grep kwin`
- Try: `qdbus org.kde.KWin /Scripting` to verify DBus connection

### No events appearing
**Problem:** Script loaded but no output

**Solution:**
1. Verify script is running: `qdbus org.kde.KWin /Scripting isScriptLoaded window-tracker`
2. Check for JavaScript errors: `journalctl --user -u plasma-kwin_wayland.service -n 100 | grep -i error`
3. Try reloading: `./scripts/run-kwin-script.sh`

### Script crashes or errors
**Problem:** JavaScript syntax errors

**Solution:**
1. Check the logs for specific error messages
2. Fix the script in `kwin-scripts/window-tracker/contents/code/main.js`
3. Redeploy: `./scripts/deploy-kwin-script.sh`
4. Reload: `./scripts/run-kwin-script.sh`

## Integration with Database Adapters

To send these events to a time series database:

1. **Parse JSON from logs:**
```bash
journalctl --user -u plasma-kwin_wayland.service -o json | \
  jq -r 'select(.MESSAGE | contains("Window Activity Tracker")) | .MESSAGE'
```

2. **Create a daemon to forward events:**
   - Read from journalctl
   - Parse JSON events
   - Send to database adapter (InfluxDB/TimescaleDB/Redis)

3. **Future enhancement:**
   - Modify script to write to Unix socket/named pipe
   - Have file-monitor daemon read from that socket
   - Correlate window events with file access events

## Script Lifecycle

```
┌─────────────────────────────────────────┐
│  1. Edit script source code             │
│     kwin-scripts/window-tracker/        │
└────────────────┬────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────┐
│  2. Deploy script                       │
│     ./scripts/deploy-kwin-script.sh     │
└────────────────┬────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────┐
│  3. Load and run                        │
│     ./scripts/run-kwin-script.sh        │
└────────────────┬────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────┐
│  4. Monitor events                      │
│     journalctl -f | grep 'Tracker'      │
└─────────────────────────────────────────┘
```

## Persistence

The script will need to be reloaded after:
- System reboot
- KWin restart
- Plasma logout/login

To make it permanent, enable in System Settings:
- **System Settings** → **Window Management** → **KWin Scripts**
- Find and enable **"Window Activity Tracker"**
- Click **Apply**

This will auto-load the script on KWin startup.

