# Desktop Agent Home Manager Module

This flake provides a Home Manager module for the Desktop Agent, which tracks window activations in KDE Plasma and file access events.

## Prerequisites

### System Configuration

Add the following to your `configuration.nix` to allow the Desktop Agent daemon to run `opensnoop` without password prompts:

```nix
# configuration.nix
{ config, pkgs, ... }:

{
  # Allow opensnoop to run without password (required)
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

The daemon uses an `opensnoop-user` wrapper that calls `sudo opensnoop` internally. This configuration allows it to run without interrupting the service.

**For detailed information about sudo configuration, see [Sudo configuration](./sudo-configuration.md).**

## Installation

### Method 1: System-level flake

Add the input to your system flake:

```nix
# flake.nix (system level)
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    home-manager = {
      url = "github:nix-community/home-manager";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    
    # Add Desktop Agent
    desktop-agent = {
      url = "github:gravio-la/desktop-activity-watcher";
      # Or a local checkout: url = "path:/path/to/desktop-activity-watcher";
    };
  };
  
  outputs = { nixpkgs, home-manager, desktop-agent, ... }: {
    homeConfigurations.yourusername = home-manager.lib.homeManagerConfiguration {
      # ... your config ...
      modules = [
        ./home.nix
        desktop-agent.homeManagerModules.desktopAgent
      ];
    };
  };
}
```

### Method 2: Home Manager standalone

```nix
# ~/.config/home-manager/flake.nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    home-manager = {
      url = "github:nix-community/home-manager";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    
    desktop-agent.url = "github:gravio-la/desktop-activity-watcher";
  };
  
  outputs = { nixpkgs, home-manager, desktop-agent, ... }: {
    homeConfigurations.yourusername = home-manager.lib.homeManagerConfiguration {
      pkgs = nixpkgs.legacyPackages.x86_64-linux;
      modules = [
        ./home.nix
        desktop-agent.homeManagerModules.desktopAgent
      ];
    };
  };
}
```

## Configuration

### Minimal Configuration

Add to your `home.nix`:

```nix
# home.nix
{ config, pkgs, ... }:

{
  services.desktopAgent = {
    enable = true;
    
    # KWin script will be installed and enabled automatically
    
    # At least one database backend should be enabled
    databases.jsonl.enable = true;  # Enabled by default
  };
}
```

### Full Configuration with InfluxDB

```nix
# home.nix
{ config, pkgs, ... }:

{
  services.desktopAgent = {
    enable = true;
    
    # KWin script configuration
    kwinScript = {
      enable = true;
      autoEnable = true;  # Automatically enable in KWin settings
    };
    
    # Daemon service
    daemon.enable = true;
    
    # Monitoring configuration
    monitoring = {
      enabled = true;
      homeDirectory = "\${HOME}";
      
      fileFilters = {
        enabled = true;
        mode = "include";
        patterns = [
          "~/daten/**"
          "~/projects/**"
          "~/Documents/**"
        ];
        excludePatterns = [
          "**/.git/**"
          "**/node_modules/**"
          "**/.cache/**"
          "**/target/**"
        ];
      };
    };
    
    # Correlation between window and file events
    correlation = {
      enabled = true;
      correlateByPid = true;
    };
    
    # Database backends
    databases = {
      influxdb = {
        enable = true;
        url = "http://localhost:8086";
        org = "my-org";
        bucket = "desktop-events";
        token = "my-secret-token";
      };
      
      jsonl = {
        enable = true;
        path = "/tmp/desktop-agent-events.jsonl";
      };
    };
    
    # Logging
    logging = {
      level = "info";
      pretty = true;
    };
  };
}
```

### Configuration with TimescaleDB

```nix
{ config, pkgs, ... }:

{
  services.desktopAgent = {
    enable = true;
    
    databases = {
      timescaledb = {
        enable = true;
        host = "localhost";
        port = 5432;
        database = "desktop_agent";
        user = "desktopagent";
        password = "secure-password";
      };
      
      jsonl.enable = true;  # Keep JSONL as backup
    };
  };
}
```

## Usage

After running `home-manager switch`, the following will be set up:

### Automatic Services

1. **KWin Script**: Installed to `~/.local/share/kwin/scripts/window-tracker`
   - Automatically enabled if `kwinScript.autoEnable = true`
   - Restart KWin to activate: `kwin_x11 --replace &` (or `kwin_wayland --replace &`)

2. **Systemd Service**: `desktop-agent.service` runs automatically
   - Started with your graphical session
   - Logs to systemd journal

### Helper Commands

The module provides several helper commands:

```bash
# Check service status
desktop-agent-status

# View live logs
desktop-agent-logs

# Query the database (if CLI is available)
desktop-agent-query --help
```

### Manual Service Control

```bash
# Start the service
systemctl --user start desktop-agent

# Stop the service
systemctl --user stop desktop-agent

# Restart the service
systemctl --user restart desktop-agent

# Disable automatic start
systemctl --user disable desktop-agent

# Enable automatic start
systemctl --user enable desktop-agent
```

## Database Setup

The module does **not** set up databases for you. You need to start them separately.

### Using Docker Compose

A `docker-compose.yml` is provided in the repository:

```bash
cd /path/to/desktop-activity-watcher
docker-compose up -d
```

This starts:
- InfluxDB on port 8086
- TimescaleDB on port 5432

### Using Nix Services (system-level)

Alternatively, configure databases in your `configuration.nix`:

```nix
# configuration.nix
{
  services.influxdb2 = {
    enable = true;
    settings = {
      http-bind-address = "127.0.0.1:8086";
    };
  };
  
  services.postgresql = {
    enable = true;
    enableTCPIP = true;
    ensureDatabases = [ "desktop_agent" ];
    ensureUsers = [{
      name = "desktopagent";
      ensureDBOwnership = true;
    }];
  };
}
```

## Configuration Options Reference

### `services.desktopAgent`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enable` | bool | `false` | Enable Desktop Agent |
| `kwinScript.enable` | bool | `true` | Install KWin script |
| `kwinScript.autoEnable` | bool | `true` | Auto-enable in KWin |
| `daemon.enable` | bool | `true` | Enable daemon service |

### `services.desktopAgent.monitoring`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | bool | `true` | Enable file monitoring |
| `homeDirectory` | str | `"${HOME}"` | Home directory path |
| `fileFilters` | attrs | See defaults | File filtering config |
| `processFilters` | attrs | See defaults | Process filtering config |

### `services.desktopAgent.databases.influxdb`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enable` | bool | `false` | Enable InfluxDB |
| `url` | str | `"http://localhost:8086"` | InfluxDB URL |
| `org` | str | `"desktop-agent"` | Organization |
| `bucket` | str | `"file-access"` | Bucket name |
| `token` | str | `"desktop-agent-token-123"` | Auth token |

### `services.desktopAgent.databases.timescaledb`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enable` | bool | `false` | Enable TimescaleDB |
| `host` | str | `"localhost"` | Database host |
| `port` | int | `5432` | Database port |
| `database` | str | `"desktop_agent"` | Database name |
| `user` | str | `"desktopagent"` | Username |
| `password` | str | `"desktopagent123"` | Password |

### `services.desktopAgent.databases.jsonl`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enable` | bool | `true` | Enable JSONL output |
| `path` | str | `"/tmp/desktop-agent-events.jsonl"` | Output file path |

## Troubleshooting

### KWin Script Not Working

1. Check if installed:
   ```bash
   ls ~/.local/share/kwin/scripts/window-tracker
   ```

2. Manually enable in System Settings:
   - System Settings → Window Management → KWin Scripts
   - Enable "Window Activity Tracker"

3. Restart KWin:
   ```bash
   kwin_x11 --replace &
   ```

4. Check logs:
   ```bash
   journalctl -f | grep -i kwin
   ```

### Daemon Not Starting

1. Check service status:
   ```bash
   systemctl --user status desktop-agent
   ```

2. View full logs:
   ```bash
   journalctl --user -u desktop-agent -n 50
   ```

3. Test daemon manually:
   ```bash
   CONFIG_PATH=~/.config/desktop-agent/config.json \
     /nix/store/.../bin/desktop-agent-daemon
   ```

### Database Connection Issues

1. Verify database is running:
   ```bash
   # InfluxDB
   curl http://localhost:8086/health
   
   # TimescaleDB
   psql -h localhost -U desktopagent -d desktop_agent -c "SELECT 1"
   ```

2. Check connection settings in config:
   ```bash
   cat ~/.config/desktop-agent/config.json
   ```

3. Enable JSONL output as fallback to ensure events are being captured

## Development

Enter the development shell:

```bash
cd /path/to/desktop-activity-watcher
nix develop
```

This provides:
- Bun runtime for daemon development
- eBPF tools for file monitoring
- Database clients for testing

## Security Considerations

The daemon service is hardened with:
- `ProtectSystem=strict` - Read-only system directories
- `ProtectHome=read-only` - Read-only home directory
- `PrivateTmp=true` - Isolated /tmp
- `NoNewPrivileges=true` - Prevent privilege escalation

Only specified paths are writable (JSONL output, config directory).

## License

GPL-2.0

