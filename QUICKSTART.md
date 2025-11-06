# Desktop Agent - Quick Start Guide

Get the TypeScript daemon running in 3 steps!

## Step 1: Enter Nix Shell

This provides all dependencies (Bun, opensnoop, qdbus, etc.):

```bash
cd /home/basti/daten/Entwicklung/metadata-extraction/ebpf-experiments
nix develop
```

## Step 2: Start Databases (Optional)

If you want to test database integration later:

```bash
docker-compose up -d
```

Check status:

```bash
db-status
```

## Step 3: Run the Daemon

### A. Deploy KWin Window Tracker

```bash
./scripts/deploy-kwin-script.sh
./scripts/run-kwin-script.sh
```

Verify it's working:

```bash
journalctl --user -f -u plasma-kwin_wayland.service | grep 'Window Activity Tracker'
```

You should see window events when you switch windows.

### B. Start the TypeScript Daemon

```bash
cd daemon
bun install   # Only needed first time
sudo -E bun run start
```

**Important**: Use `sudo -E` to preserve your environment variables!

You should see:

```
🚀 Desktop Agent Daemon starting...
📁 Home directory: /home/basti
📝 Event log: /tmp/desktop-agent-events.jsonl
🎯 Starting window tracker...
✓ Window tracker started
📂 Starting file monitor...
✓ File monitor started
✅ Desktop Agent Daemon is running
   Press Ctrl+C to stop
```

## Step 4: See It In Action!

Switch between different applications and watch the logs:

```
🪟  Switched to: Cursor [Cursor] (PID: 6695)
📂 File access: /home/basti/document.txt by cursor (PID: 6695)
🔗 Correlated: Cursor accessed /home/basti/document.txt
```

## View Captured Events

In another terminal:

```bash
# Watch events live
tail -f /tmp/desktop-agent-events.jsonl | jq

# Count events by type
cat /tmp/desktop-agent-events.jsonl | jq -r '.type' | sort | uniq -c

# Show correlated events only
cat /tmp/desktop-agent-events.jsonl | jq 'select(.type == "correlated")'

# Show what each application accessed
cat /tmp/desktop-agent-events.jsonl | \
  jq 'select(.type == "correlated") | "\(.activeWindow.application) → \(.fileAccess.path)"'
```

## Troubleshooting

### "opensnoop not found"

Make sure you're in the Nix shell:

```bash
nix develop
which opensnoop-bpfcc
```

### "Permission denied"

opensnoop requires root:

```bash
sudo bun run start
```

### No window events

Check if KWin script is running:

```bash
qdbus org.kde.KWin /Scripting isScriptLoaded window-tracker
```

If it returns `false`, reload it:

```bash
./scripts/run-kwin-script.sh
```

### Too many file events

The daemon filters out noisy paths like `.cache/` and sockets, but you can adjust the filters in `daemon/src/file-monitor.ts`.

## What's Next?

1. **Database Integration**: Modify `daemon/src/correlator.ts` to write to InfluxDB/TimescaleDB/Redis
2. **Analysis**: Build queries to find file access patterns
3. **Heatmap**: Generate file relevance scores based on access frequency and context
4. **Dashboard**: Create a web UI to visualize the data

See the main README.md for architecture details and development guide.

## Stopping Everything

```bash
# Stop the daemon
Ctrl+C in the daemon terminal

# Stop databases
docker-compose down

# Unload KWin script (optional)
qdbus org.kde.KWin /Scripting unloadScript window-tracker
```

## Development Mode

Run with auto-reload on code changes:

```bash
cd daemon
sudo bun run dev
```

Enable debug logging:

```bash
sudo LOG_LEVEL=debug bun run dev
```

Happy hacking! 🚀

