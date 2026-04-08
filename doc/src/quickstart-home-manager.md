# Quick Start Guide - Home Manager Module

Get Desktop Agent running on your NixOS/Home Manager system in 5 minutes.

## Prerequisites

- ✅ NixOS or Nix with Home Manager installed
- ✅ KDE Plasma desktop environment
- ✅ Flakes enabled in your Nix configuration

## Step 1: System Configuration (One-time)

Add this to your `configuration.nix`:

```nix
{
  # Allow opensnoop to run without password
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

Rebuild:
```bash
sudo nixos-rebuild switch
```

> **Why?** The daemon uses an `opensnoop-user` wrapper that calls `sudo opensnoop` internally. This configuration allows it to run without password prompts.
>
> **Details:** See [Sudo configuration](./sudo-configuration.md) for complete information.

## Step 2: Add Flake Input

In your system or Home Manager `flake.nix`:

```nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    home-manager.url = "github:nix-community/home-manager";
    
    # Add Desktop Agent
    desktop-agent.url = "github:gravio-la/desktop-activity-watcher";
    # Or a local checkout: desktop-agent.url = "path:/path/to/desktop-activity-watcher";
  };
}
```

## Step 3: Import Module

In your Home Manager configuration:

```nix
{
  outputs = { nixpkgs, home-manager, desktop-agent, ... }: {
    homeConfigurations.yourusername = home-manager.lib.homeManagerConfiguration {
      pkgs = nixpkgs.legacyPackages.x86_64-linux;
      modules = [
        ./home.nix
        desktop-agent.homeManagerModules.desktopAgent  # Add this line
      ];
    };
  };
}
```

## Step 4: Configure in home.nix

Add this minimal configuration:

```nix
{
  services.desktopAgent = {
    enable = true;
    
    # JSONL is enabled by default - writes to /tmp/desktop-agent-events.jsonl
    # This is enough to get started!
  };
}
```

## Step 5: Apply Configuration

```bash
home-manager switch
```

## Step 6: Verify It's Running

```bash
# Check service status
desktop-agent-status

# View live logs
desktop-agent-logs

# Check if events are being captured
tail -f /tmp/desktop-agent-events.jsonl
```

## That's It! 🎉

Your Desktop Agent is now:
- ✅ Tracking window activations
- ✅ Monitoring file access in your home directory
- ✅ Correlating events by process ID
- ✅ Writing events to JSONL file

## Next Steps

### Add a Database

#### Option A: Use Docker (Easiest)

```bash
# In the desktop-agent directory
docker-compose up -d
```

Then update your `home.nix`:

```nix
services.desktopAgent = {
  enable = true;
  
  databases.influxdb = {
    enable = true;
    url = "http://localhost:8086";
    token = "desktop-agent-token-123";
  };
};
```

Apply:
```bash
home-manager switch
```

#### Option B: Use System Services

Add to `configuration.nix`:

```nix
{
  services.influxdb2 = {
    enable = true;
    # ... configure as needed
  };
}
```

### Customize Monitoring

Filter which files to track:

```nix
services.desktopAgent = {
  enable = true;
  
  monitoring.fileFilters = {
    enabled = true;
    mode = "include";  # Only track these paths
    patterns = [
      "~/Documents/**"
      "~/projects/**"
      "~/daten/**"
    ];
    excludePatterns = [
      "**/.git/**"
      "**/node_modules/**"
      "**/.cache/**"
    ];
  };
};
```

### Use Multiple Databases

```nix
services.desktopAgent = {
  enable = true;
  
  databases = {
    # InfluxDB for time-series analytics
    influxdb = {
      enable = true;
      url = "http://localhost:8086";
      token = "your-token";
    };
    
    # TimescaleDB for SQL queries
    timescaledb = {
      enable = true;
      host = "localhost";
      password = "secure-password";
    };
    
    # JSONL as backup/debugging
    jsonl = {
      enable = true;
      path = "/tmp/desktop-agent-events.jsonl";
    };
  };
};
```

## Viewing Your Data

### JSONL File

```bash
# View recent events
tail -20 /tmp/desktop-agent-events.jsonl | jq

# Search for specific file
grep "myfile.txt" /tmp/desktop-agent-events.jsonl | jq

# Count events by type
jq -r .event_type /tmp/desktop-agent-events.jsonl | sort | uniq -c
```

### InfluxDB Web UI

Open: http://localhost:8086

Login:
- Username: `admin`
- Password: `adminpass123`

Query example:
```flux
from(bucket: "file-access")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "desktop_agent_event")
  |> limit(n: 100)
```

### Command-Line Queries (if CLI is implemented)

```bash
# Top 10 most accessed files
desktop-agent-query files --top 10

# Activity in the last hour
desktop-agent-query activity --hours 1

# Files accessed by a specific app
desktop-agent-query files --app "firefox"
```

## Troubleshooting

### Service Not Starting

```bash
# Check what went wrong
journalctl --user -u desktop-agent -n 50

# Try running daemon manually to see errors
systemctl --user stop desktop-agent
cd ~/path/to/desktop-activity-watcher/daemon
bun run dev
```

### KWin Script Not Working

```bash
# Check if installed
ls ~/.local/share/kwin/scripts/window-tracker/

# Check if enabled
kreadconfig6 --file kwinrc --group Plugins --key window-trackerEnabled

# Enable manually if needed
kwriteconfig6 --file kwinrc --group Plugins --key window-trackerEnabled true

# Restart KWin
kwin_x11 --replace &  # or kwin_wayland --replace &

# Check for events
journalctl -f | grep -i "window activity tracker"
```

### No File Events

```bash
# Test if opensnoop wrapper works (should NOT ask for password)
opensnoop-user
# Press Ctrl+C after seeing some events

# If it asks for password, check your sudo configuration in configuration.nix
# See SUDO_CONFIGURATION.md for details

# Check file patterns in config
cat ~/.config/desktop-agent/config.json | jq .monitoring.fileFilters

# View daemon logs for errors
desktop-agent-logs
```

### Database Connection Failed

```bash
# InfluxDB
curl http://localhost:8086/health

# TimescaleDB
psql -h localhost -U desktopagent -d desktop_agent -c "SELECT 1"

# Check if containers are running (if using Docker)
docker ps | grep -E "influxdb|timescaledb"
```

## Full Documentation

- **[HOME_MANAGER_MODULE.md](./home-manager-module.md)** - Complete module documentation
- **[example-home.nix](../../example-home.nix)** - Full configuration example
- **[README.md](../../README.md)** - Project overview and architecture
- **[MIGRATION_TO_HOME_MANAGER.md](./migration-to-home-manager.md)** - Migrating from manual setup

## Need Help?

1. Check the daemon logs: `desktop-agent-logs`
2. Test manually: `systemctl --user stop desktop-agent && cd daemon && bun run dev`
3. Verify config: `cat ~/.config/desktop-agent/config.json | jq`
4. Check KWin events: `journalctl -f | grep -i "window activity"`

Happy tracking! 📊

