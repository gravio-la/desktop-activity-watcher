#!/bin/bash
# Cleanup old JSONL log files that may have permission issues

LOG_FILE="${LOG_FILE:-/tmp/desktop-agent-events.jsonl}"

if [ -f "$LOG_FILE" ]; then
    echo "Removing old log file: $LOG_FILE"
    sudo rm -f "$LOG_FILE"
    echo "✓ Log file removed"
else
    echo "No log file to clean up"
fi

