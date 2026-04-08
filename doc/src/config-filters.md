# File Filtering Configuration - Quick Start

## ✅ IMPLEMENTED

The Desktop Agent now supports JSON-based configuration with file path filtering!

## Your Use Case: Monitor Only ~/daten

### Quick Setup

1. **Copy the config file**:
   ```bash
   cd daemon
   cp config.daten-only.json config.json
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
        - ~/daten/**
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
        "~/daten/**"
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

### ✅ Recorded
- ✅ Any file access in `/home/average-joe/daten/`
- ✅ Any subdirectory under `~/daten/`
- ✅ All file operations (open, read, write, close)

### ❌ Filtered Out
- ❌ Files in `~/Documents/`
- ❌ Files in `~/Downloads/`
- ❌ Files in `~/.config/`
- ❌ Git repositories (`**/.git/**`)
- ❌ node_modules directories
- ❌ Cache directories
- ❌ Log files

## How It Works

### Before (No Filtering)
```
File accessed: /home/average-joe/.config/chromium/cache/xyz   ✅ Recorded
File accessed: /home/average-joe/Downloads/file.pdf          ✅ Recorded
File accessed: /home/average-joe/daten/project/main.rs       ✅ Recorded
File accessed: /home/average-joe/.cache/mozilla/temp         ✅ Recorded
```

### After (With Filtering)
```
File accessed: /home/average-joe/.config/chromium/cache/xyz   ❌ Filtered
File accessed: /home/average-joe/Downloads/file.pdf          ❌ Filtered
File accessed: /home/average-joe/daten/project/main.rs       ✅ Recorded
File accessed: /home/average-joe/.cache/mozilla/temp         ❌ Filtered
```

## Configuration Modes

### Include Mode (Default for your case)
```json
{
  "fileFilters": {
    "mode": "include",
    "patterns": ["~/daten/**"]
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
      "~/daten/Entwicklung/**"
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
    "patterns": ["~/daten/**"],
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
      "~/daten/**",
      "~/Documents/work/**",
      "~/Projects/**"
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
     - ~/daten/**
```

### 4. Access some files
```bash
# Should be recorded (in ~/daten)
touch ~/daten/test.txt

# Should NOT be recorded (outside ~/daten)
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

You should only see files from `~/daten/` in the results.

## Environment Variables

You can override the config location:
```bash
export DESKTOP_AGENT_CONFIG=/path/to/my/config.json
sudo -E bun run start
```

## Pattern Syntax Reference

| Pattern | Matches | Example |
|---------|---------|---------|
| `~/daten/**` | Everything in ~/daten | `/home/user/daten/file.txt` |
| `~/daten/*.txt` | TXT files in ~/daten (not subdirs) | `/home/user/daten/file.txt` |
| `~/daten/**/src/**` | Source dirs anywhere | `/home/user/daten/project/src/main.rs` |
| `**/.git/**` | Git directories anywhere | `/home/user/daten/project/.git/config` |
| `**/node_modules/**` | node_modules anywhere | `/home/user/daten/web/node_modules/pkg` |

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
    "patterns": ["~/daten/**"]  // Make sure path is correct
  }
}
```

**Check 2**: Is the path correct?
```bash
# Test the pattern
ls ~/daten/  # Should show files
```

**Check 3**: Disable filters temporarily
```json
{
  "fileFilters": {
    "enabled": false
  }
}
```

### Still recording files outside ~/daten

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
🚫 Filtered file: /home/average-joe/.config/...
```

## Files Created

1. **`config.json`** - Your active configuration (copy from examples)
2. **`config.example.json`** - Full example with all options
3. **`config.daten-only.json`** - Minimal config for ~/daten only
4. **`CONFIG.md`** - Complete configuration guide

---

**Status**: ✅ Ready to use  
**Your Config**: `config.daten-only.json`  
**Action**: Copy to `config.json` and restart daemon

