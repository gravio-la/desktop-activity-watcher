{ pkgs, lib, root, cfg }:

let
  opensnoopCmd = "/run/wrappers/bin/sudo ${pkgs.linuxPackages.bcc}/bin/opensnoop";

  kwinScript = pkgs.callPackage ../pkgs/kwin-window-tracker.nix {
    src = root + "/kwin-scripts/window-tracker";
  };

  daemonSrc = root + "/daemon";

  daemonDeps = pkgs.callPackage ../pkgs/daemon-deps.nix {
    src = daemonSrc;
  };

  daemonBinary = pkgs.callPackage ../pkgs/daemon-binary.nix {
    inherit daemonDeps;
    src = daemonSrc;
  };

  daemonPackage = pkgs.writeShellScriptBin "desktop-agent-daemon" ''
    #!/usr/bin/env bash
    export OPENSNOOP_CMD="${opensnoopCmd}"
    exec ${daemonBinary}/bin/desktop-agent-daemon "$@"
  '';

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
  inherit
    opensnoopCmd
    kwinScript
    daemonDeps
    daemonBinary
    daemonPackage
    configJson
    envFile
    ;
}
