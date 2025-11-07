{
  description = "Desktop Agent - Window tracking and file monitoring for KDE Plasma";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    let
      # Home Manager module
      homeManagerModule = { config, lib, pkgs, ... }:
        let
          cfg = config.services.desktopAgent;
          
          # OpenSnoop wrapper that uses sudo
          opensnoopWrapper = pkgs.writeShellScriptBin "opensnoop-user" ''
            #!/usr/bin/env bash
            exec ${pkgs.sudo}/bin/sudo ${pkgs.linuxPackages.bcc}/bin/opensnoop "$@"
          '';
          
          # Build the KWin script package
          kwinScript = pkgs.stdenv.mkDerivation {
            pname = "kwin-window-tracker";
            version = "0.1.0";
            
            src = ./kwin-scripts/window-tracker;
            
            dontBuild = true;
            
            installPhase = ''
              runHook preInstall
              
              mkdir -p $out/share/kwin/scripts/window-tracker
              cp -r contents $out/share/kwin/scripts/window-tracker/
              cp metadata.json $out/share/kwin/scripts/window-tracker/
              
              runHook postInstall
            '';
            
            meta = with lib; {
              description = "KWin script to track window activations for Desktop Agent";
              license = licenses.gpl2;
              platforms = platforms.linux;
            };
          };
          
          # Build the daemon package
          daemonPackage = pkgs.stdenv.mkDerivation {
            pname = "desktop-agent-daemon";
            version = "0.1.0";
            
            src = ./daemon;
            
            nativeBuildInputs = [ pkgs.bun ];
            
            buildPhase = ''
              # Install dependencies
              export HOME=$TMPDIR
              bun install --frozen-lockfile --production
            '';
            
            installPhase = ''
              runHook preInstall
              
              mkdir -p $out/{bin,lib/desktop-agent}
              
              # Copy the entire daemon directory
              cp -r . $out/lib/desktop-agent/
              
              # Create wrapper script that includes opensnoop-user in PATH
              cat > $out/bin/desktop-agent-daemon <<EOF
              #!${pkgs.bash}/bin/bash
              export PATH="${opensnoopWrapper}/bin:\$PATH"
              exec ${pkgs.bun}/bin/bun run $out/lib/desktop-agent/src/index.ts "\$@"
              EOF
              chmod +x $out/bin/desktop-agent-daemon
              
              runHook postInstall
            '';
            
            meta = with lib; {
              description = "Desktop Agent daemon for processing window and file events";
              license = licenses.gpl2;
              platforms = platforms.linux;
            };
          };
          
          # Generate configuration file
          configJson = pkgs.writeText "desktop-agent-config.json" (builtins.toJSON {
            monitoring = {
              enabled = cfg.monitoring.enabled;
              homeDirectory = cfg.monitoring.homeDirectory;
              fileFilters = cfg.monitoring.fileFilters;
              processFilters = cfg.monitoring.processFilters;
            };
            correlation = {
              enabled = cfg.correlation.enabled;
              correlateByPid = cfg.correlation.correlateByPid;
            };
            databases = {
              influxdb = {
                enabled = cfg.databases.influxdb.enable;
              };
              timescaledb = {
                enabled = cfg.databases.timescaledb.enable;
              };
              jsonl = {
                enabled = cfg.databases.jsonl.enable;
                path = cfg.databases.jsonl.path;
              };
            };
            logging = {
              level = cfg.logging.level;
              pretty = cfg.logging.pretty;
            };
          });
          
          # Generate environment file for database connections
          envFile = pkgs.writeText "desktop-agent.env" ''
            ${lib.optionalString cfg.databases.influxdb.enable ''
              INFLUXDB_URL=${cfg.databases.influxdb.url}
              INFLUXDB_ORG=${cfg.databases.influxdb.org}
              INFLUXDB_BUCKET=${cfg.databases.influxdb.bucket}
              INFLUXDB_TOKEN=${cfg.databases.influxdb.token}
            ''}
            ${lib.optionalString cfg.databases.timescaledb.enable ''
              TIMESCALEDB_HOST=${cfg.databases.timescaledb.host}
              TIMESCALEDB_PORT=${toString cfg.databases.timescaledb.port}
              TIMESCALEDB_DATABASE=${cfg.databases.timescaledb.database}
              TIMESCALEDB_USER=${cfg.databases.timescaledb.user}
              TIMESCALEDB_PASSWORD=${cfg.databases.timescaledb.password}
            ''}
          '';
        in
        {
          options.services.desktopAgent = {
            enable = lib.mkEnableOption "Desktop Agent window and file monitoring";
            
            kwinScript = {
              enable = lib.mkOption {
                type = lib.types.bool;
                default = true;
                description = "Install and enable the KWin window tracking script";
              };
              
              autoEnable = lib.mkOption {
                type = lib.types.bool;
                default = true;
                description = "Automatically enable the script in KWin configuration";
              };
            };
            
            daemon = {
              enable = lib.mkOption {
                type = lib.types.bool;
                default = true;
                description = "Enable the desktop agent daemon service";
              };
            };
            
            monitoring = {
              enabled = lib.mkOption {
                type = lib.types.bool;
                default = true;
                description = "Enable file monitoring";
              };
              
              homeDirectory = lib.mkOption {
                type = lib.types.str;
                default = "\${HOME}";
                description = "Home directory to monitor";
              };
              
              fileFilters = lib.mkOption {
                type = lib.types.attrs;
                default = {
                  enabled = true;
                  mode = "include";
                  patterns = [ "~/daten/**" ];
                  excludePatterns = [
                    "**/.git/**"
                    "**/node_modules/**"
                    "**/.cache/**"
                  ];
                };
                description = "File filtering configuration";
              };
              
              processFilters = lib.mkOption {
                type = lib.types.attrs;
                default = {
                  enabled = false;
                  excludeProcesses = [];
                };
                description = "Process filtering configuration";
              };
            };
            
            correlation = {
              enabled = lib.mkOption {
                type = lib.types.bool;
                default = true;
                description = "Enable correlation between window and file events";
              };
              
              correlateByPid = lib.mkOption {
                type = lib.types.bool;
                default = true;
                description = "Correlate events by process ID";
              };
            };
            
            databases = {
              influxdb = {
                enable = lib.mkOption {
                  type = lib.types.bool;
                  default = false;
                  description = "Enable InfluxDB backend";
                };
                
                url = lib.mkOption {
                  type = lib.types.str;
                  default = "http://localhost:8086";
                  description = "InfluxDB URL";
                };
                
                org = lib.mkOption {
                  type = lib.types.str;
                  default = "desktop-agent";
                  description = "InfluxDB organization";
                };
                
                bucket = lib.mkOption {
                  type = lib.types.str;
                  default = "file-access";
                  description = "InfluxDB bucket";
                };
                
                token = lib.mkOption {
                  type = lib.types.str;
                  default = "desktop-agent-token-123";
                  description = "InfluxDB authentication token";
                };
              };
              
              timescaledb = {
                enable = lib.mkOption {
                  type = lib.types.bool;
                  default = false;
                  description = "Enable TimescaleDB backend";
                };
                
                host = lib.mkOption {
                  type = lib.types.str;
                  default = "localhost";
                  description = "TimescaleDB host";
                };
                
                port = lib.mkOption {
                  type = lib.types.int;
                  default = 5432;
                  description = "TimescaleDB port";
                };
                
                database = lib.mkOption {
                  type = lib.types.str;
                  default = "desktop_agent";
                  description = "TimescaleDB database name";
                };
                
                user = lib.mkOption {
                  type = lib.types.str;
                  default = "desktopagent";
                  description = "TimescaleDB user";
                };
                
                password = lib.mkOption {
                  type = lib.types.str;
                  default = "desktopagent123";
                  description = "TimescaleDB password";
                };
              };
              
              jsonl = {
                enable = lib.mkOption {
                  type = lib.types.bool;
                  default = true;
                  description = "Enable JSONL file output";
                };
                
                path = lib.mkOption {
                  type = lib.types.str;
                  default = "/tmp/desktop-agent-events.jsonl";
                  description = "Path to JSONL output file";
                };
              };
            };
            
            logging = {
              level = lib.mkOption {
                type = lib.types.enum [ "debug" "info" "warn" "error" ];
                default = "info";
                description = "Logging level";
              };
              
              pretty = lib.mkOption {
                type = lib.types.bool;
                default = true;
                description = "Enable pretty-printed logs";
              };
            };
          };
          
          config = lib.mkIf cfg.enable {
            # Install KWin script
            home.file = lib.mkIf cfg.kwinScript.enable {
              ".local/share/kwin/scripts/window-tracker" = {
                source = "${kwinScript}/share/kwin/scripts/window-tracker";
                recursive = true;
              };
            };
            
            # Auto-enable KWin script
            programs.plasma = lib.mkIf (cfg.kwinScript.enable && cfg.kwinScript.autoEnable) {
              configFile = {
                kwinrc = {
                  Plugins = {
                    window-trackerEnabled = true;
                  };
                };
              };
            };
            
            # Create config directory and file
            xdg.configFile."desktop-agent/config.json" = lib.mkIf cfg.daemon.enable {
              source = configJson;
            };
            
            # Systemd user service
            systemd.user.services.desktop-agent = lib.mkIf cfg.daemon.enable {
              Unit = {
                Description = "Desktop Agent - Window and file monitoring daemon";
                Documentation = "https://github.com/your-repo/desktop-agent";
                After = [ "graphical-session.target" ];
                PartOf = [ "graphical-session.target" ];
              };
              
              Service = {
                Type = "simple";
                ExecStart = "${daemonPackage}/bin/desktop-agent-daemon";
                Restart = "on-failure";
                RestartSec = "5s";
                
                # Environment
                Environment = [
                  "CONFIG_PATH=%h/.config/desktop-agent/config.json"
                  "PATH=${opensnoopWrapper}/bin:${pkgs.systemd}/bin:/run/wrappers/bin"
                ];
                EnvironmentFile = envFile;
                
                # Security hardening
                PrivateTmp = true;
                ProtectSystem = "strict";
                ProtectHome = "read-only";
                NoNewPrivileges = true;
                
                # Allow writing to temp and config directories
                ReadWritePaths = [
                  "/tmp"
                  "%h/.config/desktop-agent"
                  (lib.optionalString cfg.databases.jsonl.enable cfg.databases.jsonl.path)
                ];
                
                # Logging
                StandardOutput = "journal";
                StandardError = "journal";
                SyslogIdentifier = "desktop-agent";
              };
              
              Install = {
                WantedBy = [ "graphical-session.target" ];
              };
            };
            
            # Helper scripts and tools in user path
            home.packages = lib.mkIf cfg.daemon.enable [
              opensnoopWrapper  # opensnoop-user command for testing
              
              (pkgs.writeShellScriptBin "desktop-agent-status" ''
                #!/usr/bin/env bash
                echo "Desktop Agent Status"
                echo "===================="
                echo ""
                systemctl --user status desktop-agent
              '')
              
              (pkgs.writeShellScriptBin "desktop-agent-logs" ''
                #!/usr/bin/env bash
                journalctl --user -u desktop-agent -f
              '')
              
              (pkgs.writeShellScriptBin "desktop-agent-query" ''
                #!/usr/bin/env bash
                ${daemonPackage}/bin/desktop-agent-daemon cli "$@"
              '')
            ];
          };
        };
    in
    {
      # Export the Home Manager module
      homeManagerModules.default = homeManagerModule;
      homeManagerModules.desktopAgent = homeManagerModule;
      
    } // flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        # Development shell for working on the daemon
        devShells.default = pkgs.mkShell {
          buildInputs = [
            pkgs.bun
            pkgs.nodejs
            
            # eBPF tools (for file monitoring development)
            pkgs.bpftools
            pkgs.bpftrace
            pkgs.libbpf
            
            # Database clients for testing
            pkgs.influxdb2-cli
            pkgs.postgresql
            
            # Development utilities
            pkgs.jq
            pkgs.git
          ];

          shellHook = ''
            echo "Desktop Agent Development Environment"
            echo "====================================="
            echo ""
            echo "Daemon development:"
            echo "  cd daemon && bun install"
            echo "  cd daemon && bun run dev"
            echo ""
            echo "Testing the module:"
            echo "  nix flake check"
            echo ""
            echo "Build KWin script package:"
            echo "  nix build .#packages.${system}.kwin-window-tracker"
            echo ""
          '';
        };
        
        # Packages for testing
        packages = rec {
          kwin-window-tracker = pkgs.stdenv.mkDerivation {
            pname = "kwin-window-tracker";
            version = "0.1.0";
            src = ./kwin-scripts/window-tracker;
            dontBuild = true;
            installPhase = ''
              mkdir -p $out/share/kwin/scripts/window-tracker
              cp -r contents $out/share/kwin/scripts/window-tracker/
              cp metadata.json $out/share/kwin/scripts/window-tracker/
            '';
          };
          
          default = kwin-window-tracker;
        };
      }
    );
}
