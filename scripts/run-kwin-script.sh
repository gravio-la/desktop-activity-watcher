#!/usr/bin/env bash
# Load and Run KWin Window Tracker Script
# This script uses qdbus to load and start the window tracker

set -e

SCRIPT_NAME="window-tracker"
INSTALL_DIR="$HOME/.local/share/kwin/scripts/$SCRIPT_NAME"

echo "================================================"
echo "KWin Window Tracker - Load & Run Script"
echo "================================================"
echo ""

# Check if script is installed
if [ ! -d "$INSTALL_DIR" ]; then
    echo "❌ Error: Script not installed at $INSTALL_DIR"
    echo "   Please run deploy-kwin-script.sh first"
    exit 1
fi

if [ ! -f "$INSTALL_DIR/contents/code/main.js" ]; then
    echo "❌ Error: main.js not found in $INSTALL_DIR"
    echo "   Please run deploy-kwin-script.sh to reinstall"
    exit 1
fi

# Check if KWin is running
echo "🔍 Checking KWin status..."
if ! qdbus org.kde.KWin /Scripting >/dev/null 2>&1; then
    echo "❌ Error: KWin is not running or not accessible via DBus"
    echo "   Please make sure you are running KDE Plasma/KWin"
    exit 1
fi

echo "✅ KWin is running"
echo ""

# Check if script is already loaded
echo "🔍 Checking if script is already loaded..."
IS_LOADED=$(qdbus org.kde.KWin /Scripting isScriptLoaded "$SCRIPT_NAME" 2>/dev/null || echo "false")

if [ "$IS_LOADED" = "true" ]; then
    echo "⚠️  Script is already loaded"
    echo ""
    read -p "Do you want to reload it? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🔄 Unloading existing script..."
        qdbus org.kde.KWin /Scripting unloadScript "$SCRIPT_NAME" || true
        sleep 1
    else
        echo "ℹ️  Keeping existing script instance"
        echo ""
        echo "To view logs:"
        echo "  journalctl --user -f -u plasma-kwin_wayland.service | grep 'Window Activity Tracker'"
        exit 0
    fi
fi

# Load the script
echo "📥 Loading script..."
SCRIPT_PATH="$INSTALL_DIR/contents/code/main.js"
SCRIPT_ID=$(qdbus org.kde.KWin /Scripting loadScript "$SCRIPT_PATH" "$SCRIPT_NAME")

if [ "$SCRIPT_ID" -eq 0 ] 2>/dev/null; then
    echo "✅ Script loaded successfully (ID: $SCRIPT_ID)"
else
    echo "❌ Error: Failed to load script"
    exit 1
fi

# Verify the script is loaded
sleep 1
IS_LOADED=$(qdbus org.kde.KWin /Scripting isScriptLoaded "$SCRIPT_NAME" 2>/dev/null || echo "false")

if [ "$IS_LOADED" = "true" ]; then
    echo "✅ Script is loaded and registered"
else
    echo "⚠️  Warning: Script loaded but verification failed"
fi

# Start the script
echo "▶️  Starting script..."
SCRIPT_DBUS_PATH="/Scripting/Script$SCRIPT_ID"

if qdbus org.kde.KWin "$SCRIPT_DBUS_PATH" >/dev/null 2>&1; then
    qdbus org.kde.KWin "$SCRIPT_DBUS_PATH" run
    echo "✅ Script is now running"
else
    echo "⚠️  Warning: Could not find script DBus path"
    echo "   The script may still be running, check the logs"
fi

echo ""
echo "================================================"
echo "✅ Window Tracker is Active!"
echo "================================================"
echo ""
echo "The script is now tracking window activations."
echo ""
echo "📊 To view events in real-time:"
echo "   journalctl --user -f -u plasma-kwin_wayland.service | grep 'Window Activity Tracker'"
echo ""
echo "🔄 To reload the script:"
echo "   $0"
echo ""
echo "🛑 To stop the script:"
echo "   qdbus org.kde.KWin /Scripting unloadScript $SCRIPT_NAME"
echo ""
echo "💡 Tip: Switch between different windows to see events being logged"
echo ""

