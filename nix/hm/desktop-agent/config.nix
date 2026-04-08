{ lib, pkgs, cfg, agentPkgs }:

let
  inherit (agentPkgs)
    opensnoopCmd
    kwinScript
    daemonPackage
    configJson
    envFile
    ;
in
{
  home.file = lib.mkIf cfg.kwinScript.enable {
    ".local/share/kwin/scripts/window-tracker" = {
      source = "${kwinScript}/share/kwin/scripts/window-tracker";
      recursive = true;
    };
  };

  xdg.configFile."desktop-agent/config.json" = lib.mkIf cfg.daemon.enable {
    source = configJson;
  };

  systemd.user.services.desktop-agent = lib.mkIf cfg.daemon.enable {
    Unit = {
      Description = "Desktop Agent - Window and file monitoring daemon";
      Documentation = "https://github.com/gravio-la/desktop-activity-watcher";
      After = [ "graphical-session.target" ];
      PartOf = [ "graphical-session.target" ];
    };

    Service = {
      Type = "simple";
      ExecStart = "${daemonPackage}/bin/desktop-agent-daemon";
      Restart = "on-failure";
      RestartSec = "5s";

      Environment = [
        "CONFIG_PATH=%h/.config/desktop-agent/config.json"
        "OPENSNOOP_CMD=${opensnoopCmd}"
      ];
      EnvironmentFile = envFile;

      StandardOutput = "journal";
      StandardError = "journal";
      SyslogIdentifier = "desktop-agent";
    };

    Install = {
      WantedBy = [ "graphical-session.target" ];
    };
  };

  home.packages = lib.mkIf cfg.daemon.enable [

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
}
