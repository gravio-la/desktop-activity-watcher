# Example Home Manager configuration for Desktop Agent
# Copy relevant sections to your home.nix

{ config, pkgs, ... }:

{
  # ============================================
  # Desktop Agent Configuration
  # ============================================
  
  # IMPORTANT: Before enabling, you must:
  # 1. Clone/download the desktop-agent repository
  # 2. Run: cd /path/to/ebpf-experiments/daemon && bun install
  # 3. Configure sudo in configuration.nix (see README.md)
  
  services.desktopAgent = {
    enable = true;
    
    # KWin window tracking script
    kwinScript = {
      enable = true;
      autoEnable = true;  # Automatically enable in KWin
    };
    
    # Background daemon service
    daemon.enable = true;
    
    # File monitoring configuration
    monitoring = {
      enabled = true;
      homeDirectory = "\${HOME}";
      
      fileFilters = {
        enabled = true;
        mode = "include";  # or "exclude"
        
        # Monitor these paths
        patterns = [
          "~/daten/**"           # Your data directory
          "~/projects/**"        # Projects
          "~/Documents/**"       # Documents
          "~/Downloads/**"       # Downloads
        ];
        
        # Exclude these patterns
        excludePatterns = [
          "**/.git/**"           # Git repositories
          "**/node_modules/**"   # Node modules
          "**/.cache/**"         # Cache directories
          "**/target/**"         # Rust build output
          "**/.venv/**"          # Python virtual environments
          "**/__pycache__/**"    # Python cache
        ];
      };
      
      processFilters = {
        enabled = false;
        excludeProcesses = [
          # Optionally exclude specific processes
          # "baloo_file"
          # "updatedb"
        ];
      };
    };
    
    # Correlation engine
    correlation = {
      enabled = true;
      correlateByPid = true;  # Link window and file events by process ID
    };
    
    # ============================================
    # Database Configuration
    # ============================================
    # Note: You must start the databases separately!
    # See docker-compose.yml or use system-level Nix services
    
    databases = {
      # InfluxDB - Time-series database (good for analytics)
      influxdb = {
        enable = true;  # Set to true to use InfluxDB
        url = "http://localhost:8086";
        org = "desktop-agent";
        bucket = "file-access";
        token = "desktop-agent-token-123";  # Change this!
      };
      
      # TimescaleDB - PostgreSQL with time-series extensions
      timescaledb = {
        enable = false;  # Set to true to use TimescaleDB
        host = "localhost";
        port = 5432;
        database = "desktop_agent";
        user = "desktopagent";
        password = "desktopagent123";  # Change this!
      };
      
      # JSONL - Simple line-delimited JSON file (always recommended as backup)
      jsonl = {
        enable = true;
        path = "/tmp/desktop-agent-events.jsonl";
        # Or use XDG: "\${XDG_DATA_HOME}/desktop-agent/events.jsonl"
      };
    };
    
    # ============================================
    # Logging Configuration
    # ============================================
    
    logging = {
      level = "info";  # debug, info, warn, error
      pretty = true;   # Pretty-print logs (disable for production)
    };
  };
  
  # ============================================
  # Optional: Additional KDE Plasma configuration
  # ============================================
  
  programs.plasma = {
    enable = true;
    
    # Other KWin settings...
    # configFile.kwinrc = { ... };
  };
}

