{ lib, stdenv, bun, daemonDeps, src }:

stdenv.mkDerivation {
  pname = "desktop-agent-daemon-binary";
  version = "0.1.0";

  inherit src;

  nativeBuildInputs = [ bun ];

  buildPhase = ''
    cp -r ${daemonDeps}/node_modules .

    export HOME=$TMPDIR
    echo "Building standalone binary..."
    ls -la src/
    bun build --compile --minify --sourcemap src/index.ts --outfile desktop-agent-daemon
    echo "Build complete, checking output..."
    ls -lh desktop-agent-daemon
  '';

  installPhase = ''
    runHook preInstall

    mkdir -p $out/bin

    cp desktop-agent-daemon $out/bin/
    chmod +x $out/bin/desktop-agent-daemon

    runHook postInstall
  '';

  dontStrip = true;

  meta = with lib; {
    description = "Desktop Agent daemon standalone binary";
    license = licenses.gpl2;
    platforms = platforms.linux;
  };
}
