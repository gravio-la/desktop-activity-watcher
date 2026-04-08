# Desktop Agent - Home Manager Module

> **Track window activations and file access on your KDE Plasma desktop with declarative Nix configuration**

A Home Manager module that provides seamless integration of the Desktop Agent system into your NixOS configuration. Monitor your workflow, analyze file access patterns, and build intelligent file recommendations - all configured through Nix.

## ✨ Features

- 🪟 **Window Tracking**: Automatically tracks which applications you use
- 📁 **File Monitoring**: Monitors file access via eBPF (opensnoop)
- 🔗 **Event Correlation**: Links window focus with file operations by PID
- 💾 **Multiple Backends**: InfluxDB, TimescaleDB, or simple JSONL files
- 🔒 **Security Hardened**: Runs with minimal privileges in isolated systemd service
- ⚙️ **Declarative Config**: Everything configured through your `home.nix`
- 🚀 **Zero Manual Setup**: KWin script and daemon installed automatically

## 🎯 Quick Start

### 1. Add System Configuration (One-time)

```nix
# configuration.nix
{
  boot.kernel.sysctl = {
    "kernel.unprivileged_bpf_disabled" = 0;
  };
}
```

### 2. Add to Your Flake

```nix
# flake.nix
{
  inputs = {
    desktop-agent.url = "github:gravio-la/desktop-activity-watcher";
  };
  
  outputs = { home-manager, desktop-agent, ... }: {
    homeConfigurations.yourusername = home-manager.lib.homeManagerConfiguration {
      modules = [
        ./home.nix
        desktop-agent.homeManagerModules.desktopAgent
      ];
    };
  };
}
```

### 3. Configure in home.nix

```nix
# home.nix
{
  services.desktopAgent = {
    enable = true;
    
    # Optional: Configure database
    databases.influxdb = {
      enable = true;
      url = "http://localhost:8086";
      token = "your-token";
    };
  };
}
```

### 4. Apply

```bash
home-manager switch
```

That's it! Check status with:
```bash
desktop-agent-status
```

## 📚 Documentation

| Document | Description |
|----------|-------------|
| **[QUICKSTART_HOME_MANAGER.md](./quickstart-home-manager.md)** | 5-minute setup guide |
| **[HOME_MANAGER_MODULE.md](./home-manager-module.md)** | Complete module reference |
| **[example-home.nix](../../example-home.nix)** | Full configuration example |
| **[DOCUMENTATION_INDEX.md](./introduction.md)** | Documentation index |
| **[MIGRATION_TO_HOME_MANAGER.md](./migration-to-home-manager.md)** | Migration guide |
| **[README.md](../../README.md)** | Project overview |

**Start here**: [QUICKSTART_HOME_MANAGER.md](./quickstart-home-manager.md)

## 🔧 Configuration Options

### Minimal (JSONL only)
```nix
services.desktopAgent.enable = true;
```

### With InfluxDB
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

### With Custom Monitoring
```nix
services.desktopAgent = {
  enable = true;
  
  monitoring.fileFilters = {
    patterns = [
      "~/Documents/**"
      "~/projects/**"
    ];
    excludePatterns = [
      "**/.git/**"
      "**/.cache/**"
    ];
  };
  
  databases.jsonl.enable = true;
};
```

### Multiple Databases
```nix
services.desktopAgent = {
  enable = true;
  
  databases = {
    influxdb.enable = true;
    timescaledb.enable = true;
    jsonl.enable = true;
  };
};
```

See [example-home.nix](../../example-home.nix) for complete examples.

## 🗄️ Database Backends

| Backend | Best For | Query Language |
|---------|----------|----------------|
| **JSONL** | Debugging, simple analysis | jq, grep |
| **InfluxDB** | Time-series analytics | Flux |
| **TimescaleDB** | Complex SQL queries | SQL |

**Note**: Databases must be started separately:
```bash
docker-compose up -d  # Use provided docker-compose.yml
```

Or configure as NixOS services in your `configuration.nix`.

## 🎮 Usage

### Service Management
```bash
# Check status
desktop-agent-status

# View logs
desktop-agent-logs

# Control service
systemctl --user {start|stop|restart} desktop-agent
```

### Query Data

**JSONL:**
```bash
tail -f /tmp/desktop-agent-events.jsonl | jq
```

**InfluxDB:**
```flux
from(bucket: "file-access")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "file_access")
```

**TimescaleDB:**
```sql
SELECT * FROM desktop_agent_events
WHERE time > NOW() - INTERVAL '1 hour';
```

## 🏗️ Architecture

```
┌─────────────────┐
│   KWin Script   │  Tracks window activations
│  (JavaScript)   │  → Logs to systemd journal
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Desktop Agent  │  Bun/TypeScript daemon
│     Daemon      │  → Reads window events from journal
└────────┬────────┘  → Monitors file access via opensnoop
         │            → Correlates events by PID
         ↓
┌─────────────────┐
│   Databases     │  InfluxDB / TimescaleDB / JSONL
│                 │  → Store events for analysis
└─────────────────┘
```

## 🔒 Security

The systemd service runs with security hardening:

- ✅ `ProtectSystem=strict` - Read-only system directories
- ✅ `ProtectHome=read-only` - Read-only home (except allowed paths)
- ✅ `PrivateTmp=true` - Isolated temporary directory
- ✅ `NoNewPrivileges=true` - Cannot gain privileges
- ✅ Only specific paths writable (config, output files)

## 🎯 Use Cases

- 📊 **File Access Analytics**: Which files do you access most?
- 🔍 **Context-Aware Search**: Find files related to your current work
- 💡 **File Recommendations**: Suggest relevant files based on context
- 🔄 **Workflow Analysis**: Understand your development patterns
- 📦 **Backup Prioritization**: Identify frequently modified files
- 🧠 **Activity Tracking**: Build a complete picture of your work

## 📋 Requirements

- **OS**: NixOS or Nix with Home Manager
- **Desktop**: KDE Plasma (5.x or 6.x)
- **Kernel**: Linux 5.4+ with eBPF support
- **Nix**: Flakes enabled

## 🐛 Troubleshooting

### Service Not Starting
```bash
journalctl --user -u desktop-agent -n 50
```

### KWin Script Not Working
```bash
# Check if installed
ls ~/.local/share/kwin/scripts/window-tracker/

# Check if enabled
kreadconfig6 --file kwinrc --group Plugins --key window-trackerEnabled

# View events
journalctl -f | grep -i "window activity tracker"
```

### No File Events
```bash
# Test opensnoop manually
opensnoop

# Check daemon logs
desktop-agent-logs
```

See [HOME_MANAGER_MODULE.md](./home-manager-module.md) for comprehensive troubleshooting.

## 🚀 Development

```bash
# Enter development shell
cd /path/to/desktop-agent
nix develop

# Work on daemon
cd daemon
bun install
bun run dev

# Validate flake
nix flake check
```

## 📦 What's Included

- **Home Manager Module**: Declarative configuration
- **KWin Script**: Window tracking for KDE Plasma
- **TypeScript Daemon**: Event processing with Bun
- **Database Adapters**: InfluxDB, TimescaleDB, JSONL
- **Systemd Service**: Automatic daemon management
- **Helper Scripts**: Easy status and log viewing
- **Comprehensive Docs**: 6 detailed guides

## 🔄 Migration from Manual Setup

If you were using the old Rust-based setup or manual daemon:

See [MIGRATION_TO_HOME_MANAGER.md](./migration-to-home-manager.md) for:
- What changed and why
- Configuration mapping
- Before/after comparison
- Step-by-step migration

## 🎓 Learning Resources

- [QUICKSTART_HOME_MANAGER.md](./quickstart-home-manager.md) - Start here
- [HOME_MANAGER_MODULE.md](./home-manager-module.md) - Full reference
- [example-home.nix](../../example-home.nix) - Working examples
- [daemon/CONFIG.md](../../daemon/CONFIG.md) - Config file format
- [daemon/CLI.md](../../daemon/CLI.md) - CLI tool reference

## 📊 Status

- ✅ **Stable**: Ready for daily use
- ✅ **Tested**: KDE Plasma 6.x on NixOS
- ✅ **Documented**: 6 comprehensive guides
- ✅ **Secure**: Hardened systemd service
- ✅ **Maintained**: Active development

## 🤝 Contributing

Contributions welcome! Areas for improvement:

- Support for other desktop environments (GNOME, etc.)
- Additional database backends
- Web dashboard for visualization
- Machine learning for file recommendations
- Enhanced privacy controls

## 📜 License

GPL-2.0 (required for KWin script compatibility)

## 🙏 Acknowledgments

- KDE Plasma team for KWin scripting API
- eBPF community for BCC tools
- NixOS and Home Manager communities

## 📞 Support

1. Check the [documentation](./introduction.md)
2. Review [troubleshooting guide](./home-manager-module.md#troubleshooting)
3. Run `desktop-agent-logs` to check for errors
4. Test manually: `cd daemon && bun run dev`

---

**Made with ❤️ for KDE Plasma + NixOS users**

Start tracking your workflow: [QUICKSTART_HOME_MANAGER.md](./quickstart-home-manager.md)

