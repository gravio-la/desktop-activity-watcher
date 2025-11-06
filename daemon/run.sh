#!/usr/bin/env bash
# Helper script to run the daemon with proper privileges

set -e

cd "$(dirname "$0")"

echo "Desktop Agent Daemon Runner"
echo "==========================="
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo "✓ Running with root privileges"
    
    # Make sure we preserve the user's environment and run as their session
    if [ -n "$SUDO_USER" ]; then
        echo "✓ Real user: $SUDO_USER"
        echo ""
        bun run src/index.ts
    else
        echo "⚠️  Running as root without sudo - window tracking may not work"
        echo "   Please run as: sudo -E ./run.sh"
        echo ""
        bun run src/index.ts
    fi
else
    echo "❌ Not running as root"
    echo ""
    echo "This daemon needs root privileges for eBPF (opensnoop)."
    echo "Please run:"
    echo ""
    echo "  sudo -E ./run.sh"
    echo ""
    echo "The -E flag preserves your environment variables."
    exit 1
fi

