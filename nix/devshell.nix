{ pkgs }:

pkgs.mkShell {
  buildInputs = [
    pkgs.bun
    pkgs.nodejs
    pkgs.mdbook

    pkgs.bpftools
    pkgs.bpftrace
    pkgs.libbpf

    pkgs.influxdb2-cli
    pkgs.postgresql

    pkgs.jq
    pkgs.git
  ];

  shellHook = ''
    echo "Desktop Agent Development Environment"
    echo "====================================="
    echo ""
    echo "⚠️  IMPORTANT: The daemon runs from source, not a built package."
    echo "   Install dependencies first:"
    echo "   cd daemon && bun install"
    echo ""
    echo "Daemon development:"
    echo "  cd daemon && bun run dev       # Development with hot reload"
    echo "  cd daemon && bun run start     # Production mode"
    echo ""
    echo "Testing:"
    echo "  nix flake check                # Validate flake"
    echo "  nix build .#kwin-window-tracker # Build KWin script"
    echo "  nix build .#book               # Build mdBook (doc/)"
    echo "  cd doc && mdbook serve --open    # Preview documentation"
    echo ""
    echo "Database setup:"
    echo "  docker-compose up -d           # Start InfluxDB & TimescaleDB"
    echo ""
  '';
}
