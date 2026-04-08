{ pkgs, root }:

let
  kwin-window-tracker = pkgs.callPackage ./pkgs/kwin-window-tracker.nix {
    src = root + "/kwin-scripts/window-tracker";
  };

  book = pkgs.callPackage ./pkgs/book.nix {
    src = root + "/doc";
  };
in
{
  devShells.default = import ./devshell.nix { inherit pkgs; };

  packages = rec {
    inherit kwin-window-tracker book;
    default = kwin-window-tracker;
  };
}
