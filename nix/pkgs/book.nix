{ stdenvNoCC, mdbook, src }:

stdenvNoCC.mkDerivation {
  pname = "desktop-agent-book";
  version = "0.1.0";

  inherit src;

  nativeBuildInputs = [ mdbook ];

  dontConfigure = true;

  buildPhase = ''
    runHook preBuild
    mdbook build
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall
    mkdir -p $out/share/doc/desktop-agent/html
    cp -r book/* $out/share/doc/desktop-agent/html/
    runHook postInstall
  '';
}
