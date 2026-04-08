# Migration to Home Manager Module

This document explains the changes from the old Rust-based approach to the new Home Manager module.

## What Changed?

### Removed
- ❌ Rust file-monitor application
- ❌ Rust db-adapters library
- ❌ Manual deployment scripts (`kwin-script-runner`, `file-monitor-runner`)
- ❌ Manual KWin script installation
- ❌ Shell-based development environment only

### Added
- ✅ **Home Manager module** for declarative configuration
- ✅ **Systemd user service** for automatic daemon management
- ✅ **Configurable database options** via Nix
- ✅ **Helper scripts** (`desktop-agent-status`, `desktop-agent-logs`)
- ✅ **Auto-installation of KWin script**
- ✅ TypeScript daemon with Bun (already existed, now integrated)

### Kept
- ✅ KWin window tracking script (unchanged)
- ✅ TypeScript/Bun daemon (now the primary implementation)
- ✅ Database support (InfluxDB, TimescaleDB, JSONL)
- ✅ Docker Compose setup for databases
- ✅ Development shell with `nix develop`

## Why This Change?

1. **Simpler deployment**: One `home-manager switch` instead of multiple manual steps
2. **Declarative configuration**: All settings in your `home.nix`
3. **Automatic updates**: KWin script and daemon update with your Home Manager generation
4. **Better integration**: Systemd service managed by Home Manager
5. **Less complexity**: No need to build Rust code, TypeScript daemon is mature and tested

## Migration Steps

### If You Were Using Manual Setup

**Before (Manual):**
```bash
# Old approach
cd desktop-activity-watcher
nix develop
kwin-script-runner
cd daemon && bun run start
```

**After (Home Manager):**
```nix
# home.nix
services.desktopAgent = {
  enable = true;
  databases.influxdb.enable = true;
};
```

Then run:
```bash
home-manager switch
```

That's it! The KWin script and daemon are now installed and running.

### Configuration Mapping

#### Old: Environment Variables
```bash
export INFLUXDB_URL=http://localhost:8086
export INFLUXDB_TOKEN=my-token
```

#### New: Nix Options
```nix
services.desktopAgent = {
  databases.influxdb = {
    enable = true;
    url = "http://localhost:8086";
    token = "my-token";
  };
};
```

#### Old: JSON Config File
```json
{
  "monitoring": {
    "homeDirectory": "/home/user",
    "fileFilters": {
      "patterns": ["~/projects/**"]
    }
  }
}
```

#### New: Nix Options
```nix
services.desktopAgent = {
  monitoring = {
    homeDirectory = "\${HOME}";
    fileFilters.patterns = [ "~/projects/**" ];
  };
};
```

## Service Management

### Before (Manual)

**Starting:**
```bash
cd daemon && bun run start
```

**Checking status:**
```bash
ps aux | grep bun
```

**Viewing logs:**
```bash
# Logs mixed with other output
```

### After (Home Manager)

**Starting:**
```bash
# Automatic! Starts with your session
# Or manually:
systemctl --user start desktop-agent
```

**Checking status:**
```bash
desktop-agent-status
# Or:
systemctl --user status desktop-agent
```

**Viewing logs:**
```bash
desktop-agent-logs
# Or:
journalctl --user -u desktop-agent -f
```

## Database Setup

Database setup **has not changed**. You still need to start databases separately:

### Option 1: Docker Compose (Recommended for development)
```bash
cd desktop-activity-watcher
docker-compose up -d
```

### Option 2: NixOS System Services
```nix
# configuration.nix
{
  services.influxdb2.enable = true;
  services.postgresql.enable = true;
}
```

The only change is how you provide connection details:
- **Before**: Environment variables or daemon config.json
- **After**: Nix options in home.nix

## Development Workflow

Development workflow is mostly the same:

```bash
cd desktop-activity-watcher
nix develop    # Enter development shell

cd daemon
bun install    # Install dependencies
bun run dev    # Development with hot reload
```

To test the Home Manager module:
```bash
nix flake check    # Validate the flake
```

## File Locations

### Before (Manual)
- KWin script: Manually copied to `~/.local/share/kwin/scripts/`
- Daemon: Run from source directory
- Config: `daemon/config.json`
- Logs: Mixed with shell output

### After (Home Manager)
- KWin script: `~/.local/share/kwin/scripts/window-tracker/` (managed by Home Manager)
- Daemon: Installed as Nix package, run by systemd
- Config: `~/.config/desktop-agent/config.json` (generated from Nix options)
- Logs: Systemd journal (`journalctl --user -u desktop-agent`)

## Troubleshooting

### "I want to use the old manual approach"

The manual approach still works! Just don't enable the Home Manager module:

```bash
cd desktop-activity-watcher
nix develop
cd daemon && bun run start
```

### "The daemon is using old configuration"

After changing Nix options, restart the service:
```bash
home-manager switch
systemctl --user restart desktop-agent
```

### "I need to test with custom daemon code"

Stop the systemd service and run manually:
```bash
systemctl --user stop desktop-agent
cd desktop-activity-watcher/daemon
bun run dev    # Your custom code runs here
```

When done testing:
```bash
systemctl --user start desktop-agent
```

### "How do I uninstall?"

Just disable in your `home.nix`:
```nix
services.desktopAgent.enable = false;
```

Then:
```bash
home-manager switch
```

The KWin script, daemon, and systemd service will be removed.

## Benefits of the New Approach

1. **Reproducibility**: Your entire setup is in one configuration file
2. **Version control**: Track your desktop agent config with your other dotfiles
3. **Rollback**: Use Home Manager generations to rollback if something breaks
4. **Isolation**: The daemon runs in a hardened systemd unit
5. **Updates**: Update the flake input to get new versions
6. **Sharing**: Share your `home.nix` snippet with others

## Further Reading

- [HOME_MANAGER_MODULE.md](./home-manager-module.md) - Full module documentation
- [example-home.nix](../../example-home.nix) - Complete configuration example
- [daemon/README.md](../../daemon/README.md) - Daemon documentation
- [daemon/CLI.md](../../daemon/CLI.md) - CLI tool documentation

## Need Help?

If you run into issues:

1. Check the logs: `desktop-agent-logs`
2. Verify configuration: `cat ~/.config/desktop-agent/config.json`
3. Test daemon manually: `systemctl --user stop desktop-agent && cd daemon && bun run dev`
4. Check KWin script: `journalctl -f | grep -i "window activity tracker"`

