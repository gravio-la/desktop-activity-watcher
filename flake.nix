{
  description = "Desktop Agent - Window tracking and file monitoring for KDE Plasma";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    { self, nixpkgs, flake-utils }:
    let
      homeManagerModule = import ./nix/hm/module.nix { root = self; };
    in
    {
      homeManagerModules.default = homeManagerModule;
      homeManagerModules.desktopAgent = homeManagerModule;
    }
    // flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      import ./nix/per-system.nix {
        inherit pkgs;
        root = self;
      }
    );
}
