#!/usr/bin/env bash
# Load and Run KWin Window Tracker Script
# This script uses qdbus to load and start the window tracker

set -e

SCRIPT_NAME="window-tracker"
INSTALL_DIR="$HOME/.local/share/kwin/scripts/$SCRIPT_NAME"

# Prefer qdbus6 (Plasma 6), fall back to qdbus
if command -v qdbus6 >/dev/null 2>&1; then
  QDBUS=qdbus6
elif command -v qdbus >/dev/null 2>&1; then
  QDBUS=qdbus
else
  echo "❌ Error: qdbus6 or qdbus not found in PATH"
  exit 1
fi

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
if ! $QDBUS org.kde.KWin /Scripting >/dev/null 2>&1; then
    echo "❌ Error: KWin is not running or not accessible via DBus"
    echo "   Please make sure you are running KDE Plasma/KWin"
    exit 1
fi

echo "✅ KWin is running (using $QDBUS)"
echo ""

# Check if script is already loaded
echo "🔍 Checking if script is already loaded..."
IS_LOADED=$($QDBUS org.kde.KWin /Scripting isScriptLoaded "$SCRIPT_NAME" 2>/dev/null || echo "false")

if [ "$IS_LOADED" = "true" ]; then
    echo "⚠️  Script is already loaded"
    echo ""
    read -p "Do you want to reload it? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🔄 Unloading existing script..."
        $QDBUS org.kde.KWin /Scripting unloadScript "$SCRIPT_NAME" || true
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
SCRIPT_ID=$($QDBUS org.kde.KWin /Scripting loadScript "$SCRIPT_PATH" "$SCRIPT_NAME")

if [ "$SCRIPT_ID" -eq 0 ] 2>/dev/null; then
    echo "❌ Error: Failed to load script"
    exit 1
fi

echo "✅ Script loaded successfully (ID: $SCRIPT_ID)"

# Verify the script is loaded
sleep 1
IS_LOADED=$($QDBUS org.kde.KWin /Scripting isScriptLoaded "$SCRIPT_NAME" 2>/dev/null || echo "false")

if [ "$IS_LOADED" = "true" ]; then
    echo "✅ Script is loaded and registered"
else
    echo "⚠️  Warning: Script loaded but verification failed"
fi

# Start the script (Plasma 6 path: /Scripting/Script{id})
echo "▶️  Starting script..."
SCRIPT_DBUS_PATH="/Scripting/Script$SCRIPT_ID"

if $QDBUS org.kde.KWin "$SCRIPT_DBUS_PATH" >/dev/null 2>&1; then
    $QDBUS org.kde.KWin "$SCRIPT_DBUS_PATH" run
    echo "✅ Script is now running"
else
    echo "⚠️  Warning: Could not find script DBus path $SCRIPT_DBUS_PATH"
    echo "   The script may still be running via kwinrc — check the logs"
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
echo "   $QDBUS org.kde.KWin /Scripting unloadScript $SCRIPT_NAME"
echo ""
echo "💡 Tip: Switch between different windows to see events being logged"
echo ""
