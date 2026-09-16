{ lib, pkgs, cfg, agentPkgs }:

let
  inherit (agentPkgs)
    opensnoopCmd
    kwinScript
    daemonPackage
    configJson
    envFile
    ;

  kwriteconfig = "${pkgs.kdePackages.kconfig}/bin/kwriteconfig6";
  qdbus6Bin = "${pkgs.kdePackages.qttools}/bin/qdbus6";
  qdbusBin = "${pkgs.kdePackages.qttools}/bin/qdbus";
  qdbus = if pkgs.lib.pathExists qdbus6Bin then qdbus6Bin else qdbusBin;

  scriptMainJs = "$HOME/.local/share/kwin/scripts/window-tracker/contents/code/main.js";
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

  # Enable and load the KWin script when autoEnable is set
  home.activation.enableDesktopAgentKwinScript = lib.hm.dag.entryAfter [ "writeBoundary" ] ''
    ${lib.optionalString (cfg.kwinScript.enable && cfg.kwinScript.autoEnable) ''
      set +e
      echo "desktop-agent: enabling KWin window-tracker script in kwinrc"
      ${kwriteconfig} --file kwinrc --group Plugins --key window-trackerEnabled true

      if ! ${qdbus} org.kde.KWin /Scripting >/dev/null 2>&1; then
        echo "desktop-agent: KWin not reachable — script installed, enable on next login"
        exit 0
      fi

      if [ "${lib.boolToString cfg.kwinScript.forceReload}" = "true" ]; then
        LOADED=$(${qdbus} org.kde.KWin /Scripting isScriptLoaded window-tracker 2>/dev/null || echo "false")
        if [ "$LOADED" = "true" ]; then
          echo "desktop-agent: unloading window-tracker for reload"
          ${qdbus} org.kde.KWin /Scripting unloadScript window-tracker 2>/dev/null || true
          sleep 1
        fi
      fi

      ${qdbus} org.kde.KWin /KWin reconfigure 2>/dev/null || true
      sleep 1

      LOADED=$(${qdbus} org.kde.KWin /Scripting isScriptLoaded window-tracker 2>/dev/null || echo "false")
      if [ "$LOADED" != "true" ]; then
        echo "desktop-agent: loadScript window-tracker"
        SCRIPT_PATH="${scriptMainJs}"
        SCRIPT_ID=$(${qdbus} org.kde.KWin /Scripting loadScript "$SCRIPT_PATH" window-tracker 2>/dev/null || echo "0")
        if [ "$SCRIPT_ID" != "0" ] && [ -n "$SCRIPT_ID" ]; then
          ${qdbus} org.kde.KWin "/Scripting/Script$SCRIPT_ID" run 2>/dev/null || true
        fi
        sleep 1
        LOADED=$(${qdbus} org.kde.KWin /Scripting isScriptLoaded window-tracker 2>/dev/null || echo "false")
      fi

      if [ "$LOADED" = "true" ]; then
        echo "desktop-agent: window-tracker script is loaded"
      else
        echo "desktop-agent: WARNING — window-tracker script is NOT loaded"
        echo "desktop-agent: run scripts/run-kwin-script.sh or enable in System Settings"
      fi
      set -e
    ''}
  '';

  systemd.user.services.desktop-agent = lib.mkIf cfg.daemon.enable {
    Unit = {
      Description = "Desktop Agent - Window and file monitoring daemon";
      Documentation = "https://github.com/gravio-la/desktop-activity-watcher";
      After = [
        "graphical-session.target"
        "plasma-kwin_wayland.service"
        "plasma-kwin_x11.service"
      ];
      PartOf = [ "graphical-session.target" ];
    };

    Service = {
      Type = "simple";
      ExecStart = "${daemonPackage}/bin/desktop-agent-daemon";
      Restart = "on-failure";
      RestartSec = "5s";

      Environment = [
        "CONFIG_PATH=%h/.config/desktop-agent/config.json"
        "DESKTOP_AGENT_CONFIG=%h/.config/desktop-agent/config.json"
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
