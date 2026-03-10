#!/bin/bash

# InnoClaw Dev Status Script
cd "$(dirname "$0")"

if [ -f .dev.pid ]; then
    PID=$(cat .dev.pid)
    if ! echo "$PID" | grep -qE '^[0-9]+$'; then
        echo "Invalid PID in .dev.pid, removing file"
        rm -f .dev.pid
        echo "Dev server is not running"
    elif ps -p "$PID" > /dev/null 2>&1; then
        echo "Dev server is running (PID: $PID)"
        echo "URL: http://localhost:3000"
        echo ""
        echo "Recent logs:"
        tail -10 logs/dev.log 2>/dev/null
    else
        echo "Dev server is not running (stale PID file)"
    fi
else
    echo "Dev server is not running"
fi
