#!/usr/bin/env bash
# Capture Window Events from Journal to File
# This script reads window tracking events from journalctl and writes them to a JSONL file

set -e

OUTPUT_FILE="${OUTPUT_FILE:-/tmp/desktop-agent-window-events.jsonl}"
FOLLOW="${FOLLOW:-true}"

echo "================================================"
echo "Window Event Capture - Journal to File"
echo "================================================"
echo ""
echo "📝 Output file: $OUTPUT_FILE"
echo "🔄 Follow mode: $FOLLOW"
echo ""

# Create or clear the output file
if [ "$FOLLOW" = "false" ] && [ -f "$OUTPUT_FILE" ]; then
    echo "🗑️  Clearing existing file..."
    > "$OUTPUT_FILE"
fi

# Ensure parent directory exists
mkdir -p "$(dirname "$OUTPUT_FILE")"

# Function to extract and write JSON events
extract_events() {
    local follow_flag=""
    if [ "$FOLLOW" = "true" ]; then
        follow_flag="-f"
    fi
    
    journalctl --user -u plasma-kwin_wayland.service $follow_flag -n 0 -o cat 2>/dev/null | \
    grep --line-buffered "Window Activity Tracker:" | \
    sed -u 's/^js: Window Activity Tracker: //' | \
    while IFS= read -r line; do
        # Validate it's JSON
        if echo "$line" | jq empty 2>/dev/null; then
            echo "$line" >> "$OUTPUT_FILE"
            echo "✓ Event captured ($(date +%H:%M:%S))"
        fi
    done
}

# Check if KWin is running and script is loaded
if ! qdbus org.kde.KWin /Scripting isScriptLoaded window-tracker >/dev/null 2>&1; then
    echo "⚠️  Warning: Window tracker script is not loaded"
    echo "   Run: ./scripts/run-kwin-script.sh"
    echo ""
fi

echo "📡 Monitoring window events..."
echo "   Switch windows to generate events"
echo "   Press Ctrl+C to stop"
echo ""

# Handle cleanup on exit
cleanup() {
    echo ""
    echo ""
    echo "================================================"
    echo "📊 Capture Summary"
    echo "================================================"
    if [ -f "$OUTPUT_FILE" ]; then
        local count=$(wc -l < "$OUTPUT_FILE")
        echo "Events captured: $count"
        echo "Output file: $OUTPUT_FILE"
        echo "File size: $(du -h "$OUTPUT_FILE" | cut -f1)"
        echo ""
        echo "To view events:"
        echo "  cat $OUTPUT_FILE | jq"
        echo ""
        echo "To view last 5 events:"
        echo "  tail -5 $OUTPUT_FILE | jq"
    else
        echo "No events captured"
    fi
}

trap cleanup EXIT INT TERM

# Start extracting events
extract_events

