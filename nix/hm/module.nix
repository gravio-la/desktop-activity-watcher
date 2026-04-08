{ root }:

{ config, lib, pkgs, ... }:

import ./desktop-agent/default.nix {
  inherit config lib pkgs root;
}
