{ lib, stdenv, src }:

stdenv.mkDerivation {
  pname = "kwin-window-tracker";
  version = "0.1.0";

  inherit src;

  dontBuild = true;

  installPhase = ''
    runHook preInstall

    mkdir -p $out/share/kwin/scripts/window-tracker
    cp -r contents $out/share/kwin/scripts/window-tracker/
    cp metadata.json $out/share/kwin/scripts/window-tracker/

    runHook postInstall
  '';

  meta = with lib; {
    description = "KWin script to track window activations for Desktop Agent";
    license = licenses.gpl2;
    platforms = platforms.linux;
  };
}
