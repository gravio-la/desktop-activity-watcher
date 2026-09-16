# File Filtering Configuration - Quick Start

## Overview

The Desktop Agent supports JSON-based configuration with file path filtering. Use include/exclude patterns to record only the paths you care about.

## Example: Monitor Only ~/projects

### Quick Setup

1. **Create a config file** (or copy and edit `config.example.json`):
   ```bash
   cd daemon
   cp config.example.json config.json
   # then edit patterns to match the directories you want to track
   ```

2. **Start the daemon**:
   ```bash
   sudo -E bun run start
   ```

3. **Verify it's working**:
   You should see in the logs:
   ```
   📋 File filters enabled:
      Mode: include
      Patterns: 1
        - ~/projects/**
   ```

### The Configuration

```json
{
  "monitoring": {
    "enabled": true,
    "homeDirectory": "$HOME",
    "fileFilters": {
      "enabled": true,
      "mode": "include",
      "patterns": [
        "~/projects/**"
      ],
      "excludePatterns": [
        "**/.git/**",
        "**/node_modules/**",
        "**/.cache/**",
        "**/target/**",
        "**/*.log"
      ]
    }
  }
}
```

## What Gets Recorded

### Recorded
- Any file access under `/home/alice/projects/`
- Any subdirectory under `~/projects/`
- All file operations (open, read, write, close)

### Filtered Out
- Files in `~/Documents/`
- Files in `~/Downloads/`
- Files in `~/.config/`
- Git repositories (`**/.git/**`)
- node_modules directories
- Cache directories
- Log files

## How It Works

### Before (No Filtering)
```
File accessed: /home/alice/.config/chromium/cache/xyz   ✅ Recorded
File accessed: /home/alice/Downloads/file.pdf          ✅ Recorded
File accessed: /home/alice/projects/demo/main.rs       ✅ Recorded
File accessed: /home/alice/.cache/mozilla/temp         ✅ Recorded
```

### After (With Filtering)
```
File accessed: /home/alice/.config/chromium/cache/xyz   ❌ Filtered
File accessed: /home/alice/Downloads/file.pdf          ❌ Filtered
File accessed: /home/alice/projects/demo/main.rs       ✅ Recorded
File accessed: /home/alice/.cache/mozilla/temp         ❌ Filtered
```

## Configuration Modes

### Include Mode
```json
{
  "fileFilters": {
    "mode": "include",
    "patterns": ["~/projects/**"]
  }
}
```
**Effect**: ONLY files matching patterns are recorded

### Exclude Mode
```json
{
  "fileFilters": {
    "mode": "exclude",
    "patterns": ["~/.cache/**", "~/.config/**"]
  }
}
```
**Effect**: ALL files EXCEPT those matching patterns are recorded

## Statistics

After running the daemon, you'll see statistics on shutdown:

```
📊 Event statistics:
   Window events: 15
   File events: 120          ← Events that matched filters
   Correlated events: 30
   Filtered events: 2500     ← Events that were filtered out
```

The `Filtered events` count shows how many file accesses were excluded by your filters.

## Advanced Examples

### Only Monitor Development Projects
```json
{
  "fileFilters": {
    "enabled": true,
    "patterns": [
      "~/projects/**",
      "~/src/**"
    ],
    "excludePatterns": [
      "**/node_modules/**",
      "**/target/**",
      "**/.git/**"
    ]
  }
}
```

### Only Monitor Specific File Types
```json
{
  "fileFilters": {
    "enabled": true,
    "patterns": ["~/projects/**"],
    "extensions": [".rs", ".ts", ".js", ".py", ".md"]
  }
}
```

### Monitor Multiple Directories
```json
{
  "fileFilters": {
    "enabled": true,
    "patterns": [
      "~/projects/**",
      "~/Documents/work/**",
      "~/code/**"
    ]
  }
}
```

## Testing Your Config

### 1. Test the config file exists
```bash
cd daemon
ls -la config.json
```

### 2. Start the daemon
```bash
sudo -E bun run start
```

### 3. Check logs for filter configuration
Look for:
```
📋 File filters enabled:
   Mode: include
   Patterns: 1
     - ~/projects/**
```

### 4. Access some files
```bash
# Should be recorded (in ~/projects)
touch ~/projects/test.txt

# Should NOT be recorded (outside ~/projects)
touch ~/Downloads/test.txt
```

### 5. Check statistics
When you stop the daemon (Ctrl+C), check:
```
   Filtered events: 1234  ← Should be > 0 if filters are working
```

### 6. Query the database
```bash
bun run cli list --since 5m --limit 10
```

You should only see files from `~/projects/` in the results.

## Environment Variables

The daemon searches for config in this order:

1. `CONFIG_PATH` (set by the Home Manager systemd unit)
2. `DESKTOP_AGENT_CONFIG`
3. `~/.config/desktop-agent/config.json`
4. `./config.json`, `./daemon/config.json`, `/etc/desktop-agent/config.json`

```bash
export CONFIG_PATH=~/.config/desktop-agent/config.json
sudo -E bun run start
```

## Pattern Syntax Reference

| Pattern | Matches | Example |
|---------|---------|---------|
| `~/projects/**` | Everything in ~/projects | `/home/user/projects/file.txt` |
| `~/projects/*.txt` | TXT files in ~/projects (not subdirs) | `/home/user/projects/file.txt` |
| `~/projects/**/src/**` | Source dirs under projects | `/home/user/projects/demo/src/main.rs` |
| `**/.git/**` | Git directories anywhere | `/home/user/projects/demo/.git/config` |
| `**/node_modules/**` | node_modules anywhere | `/home/user/projects/web/node_modules/pkg` |

## Implementation Details

### Where Filtering Happens
- Filters are applied in `correlator.ts` before writing to databases
- Filtered events are counted but not stored
- No performance impact on unfiltered events

### Pattern Matching
- Uses regex conversion from glob patterns
- Supports `*`, `**`, `?` wildcards
- Environment variables expanded (`$HOME`, `~`)
- Case-sensitive matching

### Order of Operations
1. File access event received
2. Check exclude patterns (if match → filter out)
3. Check include patterns (if not match → filter out)
4. Check extensions (if specified and not match → filter out)
5. Check process filters
6. If passes all filters → write to databases

## Performance

- **Minimal overhead**: Pattern matching is fast (regex-based)
- **No disk I/O**: Filtering happens in memory
- **Efficient**: Filtered events aren't written to databases

## Troubleshooting

### No events are being recorded

**Check 1**: Are filters too restrictive?
```json
{
  "fileFilters": {
    "enabled": true,
    "patterns": ["~/projects/**"]  // Make sure path is correct
  }
}
```

**Check 2**: Is the path correct?
```bash
# Test the pattern
ls ~/projects/  # Should show files
```

**Check 3**: Disable filters temporarily
```json
{
  "fileFilters": {
    "enabled": false
  }
}
```

### Still recording files outside the include patterns

**Check**: Make sure config file is loaded
```bash
# Check daemon logs on startup
📋 File filters enabled:  ← Should see this
```

If not shown, the config file isn't being loaded.

### Patterns not matching

**Enable debug logging**:
```json
{
  "logging": {
    "level": "debug"
  }
}
```

Then check logs for:
```
🚫 Filtered file: /home/alice/.config/...
```

## Related Files

1. **`config.json`** - Your active configuration (copy from examples)
2. **`config.example.json`** - Full example with all options
3. **`CONFIG.md`** - Complete configuration guide

---

**Status**: Ready to use  
**Action**: Copy `config.example.json` to `config.json`, set your include patterns, and restart the daemon
