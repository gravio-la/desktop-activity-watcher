{ config, lib, pkgs, root, ... }:

let
  cfg = config.services.desktopAgent;

  # pkgs.bcc has uapi headers only; kernelPackages.bcc matches the running kernel (nixpkgs #463712).
  bccPackage =
    if lib.hasAttrByPath [ "nixos" "config" "boot" "kernelPackages" ] config then
      config.nixos.config.boot.kernelPackages.bcc
    else
      pkgs.linuxPackages.bcc;

  agentPkgs = import ../agent-packages.nix { inherit pkgs lib root cfg bccPackage; };
in
{
  imports = [ ./options.nix ];

  config = lib.mkIf cfg.enable (import ./config.nix { inherit lib pkgs cfg agentPkgs; });
}
