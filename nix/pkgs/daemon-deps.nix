{ stdenv, bun, src }:

stdenv.mkDerivation {
  pname = "desktop-agent-deps";
  version = "0.1.0";

  inherit src;

  nativeBuildInputs = [ bun ];

  buildPhase = ''
    export HOME=$TMPDIR
    bun install --frozen-lockfile --no-progress
  '';

  installPhase = ''
    mkdir -p $out
    cp -r node_modules $out/
  '';

  dontFixup = true;

  outputHashMode = "recursive";
  outputHashAlgo = "sha256";
  outputHash = "sha256-BxFY+fwxccpr8uYVEPXsZJrLBgoiOwbkeRjRbahADHU=";
}
