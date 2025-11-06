{
  description = "Desktop Agent Prototype - KWin scripting and eBPF file monitoring";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
        };

        # Script to deploy KWin script
        kwin-script-runner = pkgs.writeShellScriptBin "kwin-script-runner" ''
          #!/usr/bin/env bash
          set -e
          
          SCRIPT_DIR="$PWD/kwin-scripts/window-tracker"
          INSTALL_DIR="$HOME/.local/share/kwin/scripts/window-tracker"
          
          echo "Desktop Agent - KWin Script Runner"
          echo "==================================="
          echo ""
          
          if [ ! -d "$SCRIPT_DIR" ]; then
            echo "Error: KWin script directory not found at $SCRIPT_DIR"
            exit 1
          fi
          
          echo "Installing KWin script to $INSTALL_DIR..."
          mkdir -p "$INSTALL_DIR"
          cp -r "$SCRIPT_DIR"/* "$INSTALL_DIR/"
          
          echo "Script installed successfully!"
          echo ""
          echo "To enable the script:"
          echo "1. Open System Settings > Window Management > KWin Scripts"
          echo "2. Enable 'Window Activity Tracker'"
          echo "3. Or run: kwriteconfig5 --file kwinrc --group Plugins --key window-trackerEnabled true"
          echo "4. Then restart KWin: kwin_x11 --replace & (or kwin_wayland --replace &)"
          echo ""
          echo "To view script output:"
          echo "  journalctl -f | grep kwin"
        '';

        # Script to run file monitor
        file-monitor-runner = pkgs.writeShellScriptBin "file-monitor-runner" ''
          #!/usr/bin/env bash
          set -e
          
          echo "Desktop Agent - File Monitor Runner"
          echo "===================================="
          echo ""
          
          if [ ! -f "$PWD/file-monitor/target/release/file-monitor" ]; then
            echo "Building file-monitor..."
            cd "$PWD/file-monitor"
            cargo build --release
            cd ..
          fi
          
          echo "Starting file monitor..."
          echo "Note: This requires root privileges for eBPF"
          echo ""
          
          sudo "$PWD/file-monitor/target/release/file-monitor" "$@"
        '';

        # Helper to check database status
        db-status = pkgs.writeShellScriptBin "db-status" ''
          #!/usr/bin/env bash
          
          echo "Desktop Agent - Database Status"
          echo "================================"
          echo ""
          
          # Check Docker
          if ! command -v docker &> /dev/null; then
            echo "Error: Docker is not installed or not in PATH"
            exit 1
          fi
          
          echo "Checking database containers..."
          echo ""
          
          # Check InfluxDB
          if docker ps | grep -q desktop-agent-influxdb; then
            echo "✓ InfluxDB: Running (http://localhost:8086)"
            echo "  - Organization: desktop-agent"
            echo "  - Bucket: file-access"
            echo "  - Token: desktop-agent-token-123"
          else
            echo "✗ InfluxDB: Not running"
          fi
          echo ""
          
          # Check TimescaleDB
          if docker ps | grep -q desktop-agent-timescaledb; then
            echo "✓ TimescaleDB: Running (postgresql://localhost:5432/desktop_agent)"
            echo "  - User: desktopagent"
            echo "  - Database: desktop_agent"
          else
            echo "✗ TimescaleDB: Not running"
          fi
          echo ""
          
          # Check Redis
          if docker ps | grep -q desktop-agent-redis; then
            echo "✓ Redis: Running (redis://localhost:6379)"
            echo "  - Modules: RedisTimeSeries, RedisJSON, RediSearch"
          else
            echo "✗ Redis: Not running"
          fi
          echo ""
          
          echo "To start databases: docker-compose up -d"
          echo "To stop databases: docker-compose down"
        '';

      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = [
            # KDE/Plasma dependencies
            pkgs.kdePackages.kwin
            pkgs.kdePackages.plasma-workspace
            pkgs.kdePackages.kcoreaddons
            pkgs.kdePackages.kconfig
            pkgs.kdePackages.kdbusaddons
            
            # eBPF tools and libraries
            pkgs.bpftools
            pkgs.bpftrace
            pkgs.libbpf
            pkgs.elfutils
            pkgs.linuxPackages.bcc  # Provides opensnoop and other BCC tools
            pkgs.python3Packages.bcc
            
            # Build tools for eBPF
            pkgs.clang
            pkgs.llvm
            pkgs.pkg-config
            
            # System monitoring tools
            pkgs.linuxPackages.perf
            pkgs.strace
            pkgs.lsof
            
            # Rust toolchain
            pkgs.rustc
            pkgs.cargo
            pkgs.rustfmt
            pkgs.clippy
            
            # JavaScript/TypeScript runtime
            pkgs.nodejs
            pkgs.bun
            
            # Database clients
            pkgs.influxdb2-cli
            pkgs.postgresql
            pkgs.redis
            
            # Development utilities
            pkgs.jq
            pkgs.git
            pkgs.docker-compose
            
            # Helper scripts
            kwin-script-runner
            file-monitor-runner
            db-status
          ];

          shellHook = ''
            echo "Desktop Agent Prototype Development Environment"
            echo "==============================================="
            echo ""
            
            # Check for opensnoop and show its location
            OPENSNOOP_PATH=$(find ${pkgs.linuxPackages.bcc} -name opensnoop -type f 2>/dev/null | head -1)
            if [ -n "$OPENSNOOP_PATH" ]; then
              export PATH="$(dirname "$OPENSNOOP_PATH"):$PATH"
              echo "✓ opensnoop available at: $OPENSNOOP_PATH"
            fi
            
            echo ""
            echo "Available tools:"
            echo "  kwin-script-runner  - Deploy KWin window tracking script"
            echo "  file-monitor-runner - Run eBPF file monitoring daemon"
            echo "  db-status           - Check database container status"
            echo ""
            echo "TypeScript Daemon (Bun):"
            echo "  cd daemon && bun install       - Install dependencies"
            echo "  cd daemon && bun run dev       - Run daemon in dev mode"
            echo "  cd daemon && bun run start     - Run daemon (needs sudo)"
            echo ""
            echo "Database setup:"
            echo "  docker-compose up -d  - Start all databases"
            echo "  docker-compose down   - Stop all databases"
            echo ""
            echo "eBPF tools:"
            echo "  opensnoop           - Track file opens (needs sudo)"
            echo "  bpftrace            - Custom BPF scripts (needs sudo)"
            echo ""
            echo "⚠️  Important: eBPF tools require root privileges"
            echo "   Run daemon with: sudo -E bun run start"
            echo ""
          '';
        };

        apps = {
          kwin-script-runner = {
            type = "app";
            program = "${kwin-script-runner}/bin/kwin-script-runner";
          };
          
          file-monitor-runner = {
            type = "app";
            program = "${file-monitor-runner}/bin/file-monitor-runner";
          };
          
          db-status = {
            type = "app";
            program = "${db-status}/bin/db-status";
          };
        };

        packages = {
          inherit kwin-script-runner file-monitor-runner db-status;
        };
      }
    );
}

