# Desktop Agent Configuration Guide

## Overview

The Desktop Agent can be configured using a JSON configuration file. This allows you to:
- **Filter which files** are monitored (by path patterns)
- **Filter which processes** are monitored
- **Configure databases** connection settings
- **Control logging** behavior

## Configuration File Location

The daemon searches for `config.json` in the following locations (in order):

1. Path specified in `DESKTOP_AGENT_CONFIG` environment variable
2. `./config.json` (current directory)
3. `./daemon/config.json`
4. `/etc/desktop-agent/config.json`

## Quick Start

### Example: Only Monitor ~/daten Directory

```json
{
  "monitoring": {
    "fileFilters": {
      "enabled": true,
      "mode": "include",
      "patterns": [
        "~/daten/**"
      ]
    }
  }
}
```

Save this as `daemon/config.json` and the daemon will only record file accesses within your `~/daten` directory.

## Complete Configuration

```json
{
  "monitoring": {
    "enabled": true,
    "homeDirectory": "$HOME",
    "fileFilters": {
      "enabled": true,
      "mode": "include",
      "patterns": [
        "~/daten/**",
        "~/Documents/**",
        "~/Projects/**"
      ],
      "excludePatterns": [
        "**/.git/**",
        "**/node_modules/**",
        "**/.cache/**",
        "**/tmp/**",
        "**/*.log"
      ],
      "minFileSize": 0,
      "extensions": [".md", ".txt", ".pdf", ".json"]
    },
    "processFilters": {
      "enabled": false,
      "includeProcesses": ["cursor", "code", "firefox"],
      "excludeProcesses": ["kwin_wayland", "plasmashell"]
    }
  },
  "correlation": {
    "enabled": true,
    "correlateByPid": true
  },
  "databases": {
    "influxdb": {
      "enabled": true,
      "url": "http://localhost:8086",
      "token": "desktop-agent-token-123",
      "org": "desktop-agent",
      "bucket": "file-access"
    },
    "timescaledb": {
      "enabled": true,
      "connectionString": "postgresql://desktopagent:desktopagent123@localhost:5432/desktop_agent"
    },
    "redis": {
      "enabled": true,
      "url": "redis://localhost:6379"
    },
    "jsonl": {
      "enabled": true,
      "path": "/tmp/desktop-agent-events.jsonl"
    }
  },
  "logging": {
    "level": "info",
    "pretty": true
  }
}
```

## Configuration Options

### Monitoring

#### `monitoring.enabled`
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Master switch for monitoring

#### `monitoring.homeDirectory`
- **Type**: `string`
- **Default**: `"$HOME"`
- **Description**: Base directory for file monitoring. Supports environment variables.

### File Filters

#### `monitoring.fileFilters.enabled`
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Enable file filtering

#### `monitoring.fileFilters.mode`
- **Type**: `"include"` | `"exclude"`
- **Default**: `"include"`
- **Description**:
  - `"include"`: Only monitor files matching patterns
  - `"exclude"`: Monitor all files except those matching patterns

#### `monitoring.fileFilters.patterns`
- **Type**: `string[]`
- **Default**: `[]`
- **Description**: Glob patterns for files to include
- **Examples**:
  ```json
  "patterns": [
    "~/daten/**",              // All files in ~/daten
    "~/Documents/*.pdf",       // PDF files in Documents
    "~/Projects/**/src/**",    // Source files in Projects
    "$HOME/work/**"            // Using environment variable
  ]
  ```

#### `monitoring.fileFilters.excludePatterns`
- **Type**: `string[]`
- **Default**: `[]`
- **Description**: Glob patterns for files to exclude (takes precedence over include)
- **Examples**:
  ```json
  "excludePatterns": [
    "**/.git/**",              // Exclude git directories
    "**/node_modules/**",      // Exclude node_modules
    "**/*.log",                // Exclude log files
    "**/tmp/**",               // Exclude temp directories
    "**/.cache/**"             // Exclude cache directories
  ]
  ```

#### `monitoring.fileFilters.extensions`
- **Type**: `string[]`
- **Default**: `[]`
- **Description**: Only monitor files with these extensions
- **Examples**:
  ```json
  "extensions": [".md", ".txt", ".pdf", ".doc", ".docx"]
  ```

### Process Filters

#### `monitoring.processFilters.enabled`
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Enable process filtering

#### `monitoring.processFilters.includeProcesses`
- **Type**: `string[]`
- **Default**: `[]`
- **Description**: Only monitor these processes
- **Examples**:
  ```json
  "includeProcesses": ["cursor", "code", "firefox", "chrome"]
  ```

#### `monitoring.processFilters.excludeProcesses`
- **Type**: `string[]`
- **Default**: `[]`
- **Description**: Exclude these processes from monitoring
- **Examples**:
  ```json
  "excludeProcesses": ["kwin_wayland", "plasmashell", "systemd"]
  ```

## Pattern Syntax

### Glob Patterns

- `*` - Matches any characters within a single path segment
- `**` - Matches any characters across multiple path segments
- `?` - Matches a single character
- `~` - Expands to user's home directory
- `$VAR` or `${VAR}` - Environment variable expansion

### Examples

```json
{
  "patterns": [
    "~/daten/**",                    // Everything in ~/daten
    "~/Documents/*.pdf",             // PDF files in Documents (not subdirs)
    "~/Projects/**/test/**",         // Test files in any project
    "$HOME/work/**/*.md",            // Markdown files in work directory
    "~/daten/Entwicklung/**"         // Your development folder
  ],
  "excludePatterns": [
    "**/.git/**",                    // No git directories
    "**/node_modules/**",            // No node_modules
    "**/*.tmp",                      // No temp files
    "**/build/**",                   // No build outputs
    "**/.DS_Store"                   // No macOS metadata
  ]
}
```

## Use Cases

### 1. Monitor Only Development Work

```json
{
  "monitoring": {
    "fileFilters": {
      "enabled": true,
      "mode": "include",
      "patterns": [
        "~/daten/Entwicklung/**"
      ],
      "excludePatterns": [
        "**/.git/**",
        "**/node_modules/**",
        "**/target/**",
        "**/.cache/**"
      ]
    }
  }
}
```

### 2. Monitor Documents, Exclude Media

```json
{
  "monitoring": {
    "fileFilters": {
      "enabled": true,
      "mode": "include",
      "patterns": ["~/daten/**"],
      "excludePatterns": [
        "**/*.mp3",
        "**/*.mp4",
        "**/*.avi",
        "**/*.jpg",
        "**/*.png"
      ]
    }
  }
}
```

### 3. Monitor Only Specific Applications

```json
{
  "monitoring": {
    "fileFilters": {
      "enabled": true,
      "patterns": ["~/daten/**"]
    },
    "processFilters": {
      "enabled": true,
      "includeProcesses": ["cursor", "code", "idea", "firefox"]
    }
  }
}
```

### 4. Monitor Everything Except System Files

```json
{
  "monitoring": {
    "fileFilters": {
      "enabled": true,
      "mode": "exclude",
      "excludePatterns": [
        "**/.cache/**",
        "**/.local/share/**",
        "**/.config/**",
        "**/.mozilla/**"
      ]
    }
  }
}
```

## Testing Your Configuration

After creating your config file:

```bash
# Test the configuration
cd daemon
sudo -E bun run start

# Watch the logs to see filter statistics
# You should see:
#   📋 File filters enabled:
#      Mode: include
#      Patterns: 1
#        - ~/daten/**
```

The daemon will log:
- Number of events recorded
- Number of events filtered

Check the statistics on shutdown:
```
📊 Event statistics:
   Window events: 10
   File events: 50
   Correlated events: 5
   Filtered events: 1000    ← Events that were filtered out
```

## Environment Variables

You can use environment variables in the config:

```json
{
  "monitoring": {
    "homeDirectory": "$HOME",
    "fileFilters": {
      "patterns": [
        "${WORK_DIR}/**",
        "$HOME/daten/**"
      ]
    }
  }
}
```

Then run:
```bash
export WORK_DIR="/home/user/projects"
sudo -E bun run start
```

## Validation

The configuration is validated using Zod schemas. If your config is invalid, the daemon will:
1. Show an error message with details
2. Refuse to start
3. Point to the validation error

Example error:
```
❌ Failed to load config from config.json:
ZodError: [
  {
    "code": "invalid_type",
    "expected": "string",
    "received": "number",
    "path": ["monitoring", "homeDirectory"],
    "message": "Expected string, received number"
  }
]
```

## Performance Tips

1. **Use specific patterns**: `~/daten/**` is better than `$HOME/**`
2. **Exclude early**: Put common excludes first
3. **Avoid too many patterns**: Each pattern is checked for every file access
4. **Use extensions filter**: More efficient than pattern matching

## Default Behavior

If no config file is found, the daemon uses these defaults:
- Monitor entire home directory
- No file filtering
- No process filtering
- All databases enabled
- Info level logging

## Troubleshooting

### No events are being recorded

Check if your patterns are too restrictive:
```json
{
  "monitoring": {
    "fileFilters": {
      "enabled": true,
      "mode": "include",
      "patterns": ["~/daten/**"]
    }
  }
}
```

### Too many events

Add exclusion patterns:
```json
{
  "monitoring": {
    "fileFilters": {
      "excludePatterns": [
        "**/.git/**",
        "**/node_modules/**",
        "**/.cache/**",
        "**/*.log"
      ]
    }
  }
}
```

### Pattern not matching

Enable debug logging to see what's being filtered:
```json
{
  "logging": {
    "level": "debug"
  }
}
```

Then check logs for:
```
🚫 Filtered file: /home/user/some/path
```

---

**Last Updated**: November 6, 2025  
**Version**: 1.0.0

