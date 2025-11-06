#!/usr/bin/env bash
# Deploy KWin Window Tracker Script
# This script installs/updates the window-tracker KWin script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SOURCE_DIR="$PROJECT_ROOT/kwin-scripts/window-tracker"
INSTALL_DIR="$HOME/.local/share/kwin/scripts/window-tracker"

echo "================================================"
echo "KWin Window Tracker - Deployment Script"
echo "================================================"
echo ""

# Check if source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo "❌ Error: Source directory not found: $SOURCE_DIR"
    exit 1
fi

# Check if metadata.json exists
if [ ! -f "$SOURCE_DIR/metadata.json" ]; then
    echo "❌ Error: metadata.json not found in $SOURCE_DIR"
    exit 1
fi

# Check if main.js exists
if [ ! -f "$SOURCE_DIR/contents/code/main.js" ]; then
    echo "❌ Error: main.js not found in $SOURCE_DIR/contents/code/"
    exit 1
fi

echo "📂 Source directory: $SOURCE_DIR"
echo "📂 Install directory: $INSTALL_DIR"
echo ""

# Create install directory if it doesn't exist
if [ ! -d "$INSTALL_DIR" ]; then
    echo "📁 Creating install directory..."
    mkdir -p "$INSTALL_DIR"
fi

# Backup existing installation if it exists
if [ -d "$INSTALL_DIR" ] && [ "$(ls -A "$INSTALL_DIR")" ]; then
    BACKUP_DIR="$INSTALL_DIR.backup.$(date +%Y%m%d_%H%M%S)"
    echo "💾 Backing up existing installation to: $BACKUP_DIR"
    cp -r "$INSTALL_DIR" "$BACKUP_DIR"
fi

# Copy script files
echo "📋 Copying script files..."
cp -r "$SOURCE_DIR"/* "$INSTALL_DIR/"

# Verify installation
if [ -f "$INSTALL_DIR/metadata.json" ] && [ -f "$INSTALL_DIR/contents/code/main.js" ]; then
    echo "✅ Script files copied successfully"
else
    echo "❌ Error: Installation verification failed"
    exit 1
fi

# Check if KWin is running
if ! qdbus org.kde.KWin /Scripting >/dev/null 2>&1; then
    echo ""
    echo "⚠️  Warning: KWin is not running or not accessible via DBus"
    echo "   The script has been installed but cannot be loaded yet."
    echo "   Please start KDE Plasma/KWin and run the load script."
    exit 0
fi

echo ""
echo "================================================"
echo "✅ Deployment Complete!"
echo "================================================"
echo ""
echo "Next steps:"
echo "  1. Run the load script to start tracking:"
echo "     ./scripts/run-kwin-script.sh"
echo ""
echo "  2. Or enable it permanently in System Settings:"
echo "     System Settings > Window Management > KWin Scripts"
echo "     Enable 'Window Activity Tracker'"
echo ""
echo "  3. View logs with:"
echo "     journalctl --user -f -u plasma-kwin_wayland.service | grep 'Window Activity Tracker'"
echo ""

