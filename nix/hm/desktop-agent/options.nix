{ lib, ... }:

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
        default = false;
        description = "Automatically enable the script in KWin configuration (requires plasma-manager)";
      };

      forceReload = lib.mkOption {
        type = lib.types.bool;
        default = true;
        description = ''
          On home-manager activation, unload and reload the window-tracker script when
          KWin is reachable. Ensures script updates take effect without a full session restart.
        '';
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
          excludeProcesses = [ ];
        };
        description = "Process filtering configuration";
      };

      kwinJournalUnit = lib.mkOption {
        type = lib.types.nullOr lib.types.str;
        default = null;
        example = "plasma-kwin_wayland.service";
        description = ''
          systemd user unit for KWin journal tailing. When null, the daemon auto-detects
          plasma-kwin_wayland.service or plasma-kwin_x11.service at startup.
        '';
      };

      processIdentity = lib.mkOption {
        type = lib.types.submodule {
          options = {
            captureCommandLine = lib.mkOption {
              type = lib.types.bool;
              default = false;
              description = ''
                Record /proc/{pid}/cmdline on file access events. Disabled by default
                because argv may contain passwords, tokens, or other sensitive data.
                Executable path (/proc/{pid}/exe) is always recorded when readable.
              '';
            };
          };
        };
        default = { captureCommandLine = false; };
        description = "How much process identity to attach to file access events";
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
          default = false;
          description = "Enable JSONL file output (debug only; Timescale is the production sink)";
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
}
