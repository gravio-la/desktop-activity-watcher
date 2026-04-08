{ config, lib, pkgs, root, ... }:

let
  cfg = config.services.desktopAgent;
  agentPkgs = import ../agent-packages.nix { inherit pkgs lib root cfg; };
in
{
  imports = [ ./options.nix ];

  config = lib.mkIf cfg.enable (import ./config.nix { inherit lib pkgs cfg agentPkgs; });
}
