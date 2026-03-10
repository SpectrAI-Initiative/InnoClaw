#!/bin/bash

# InnoClaw Dev Stop Script
cd "$(dirname "$0")"

PORT=3000

# Function to kill process by port
kill_port_process() {
    local port=$1
    # Only kill node/next processes, not VSCode port forwarding
    local pids=$(lsof -t -i:$port 2>/dev/null)
    if [ -n "$pids" ]; then
        for pid in $pids; do
            local cmdline=$(ps -p "$pid" -o args= 2>/dev/null)
            # Skip VSCode related processes
            if echo "$cmdline" | grep -qE "(vscode|code-server|sshd)"; then
                echo "Skipping VSCode/SSH process: $pid"
                continue
            fi
            # Only kill node/next related processes
            if echo "$cmdline" | grep -qE "(node|next|npm)"; then
                echo "Found process $pid on port $port, killing..."
                kill "$pid" 2>/dev/null
                sleep 2
                if ps -p "$pid" > /dev/null 2>&1; then
                    echo "Force killing..."
                    kill -9 "$pid" 2>/dev/null
                    sleep 1
                fi
            fi
        done
        return 0
    fi
    return 1
}

stopped=false

# Try to stop by PID file first
if [ -f .dev.pid ]; then
    PID=$(cat .dev.pid)
    if ! echo "$PID" | grep -qE '^[0-9]+$'; then
        echo "Invalid PID in .dev.pid, removing file"
        rm -f .dev.pid
    elif ps -p "$PID" > /dev/null 2>&1; then
        echo "Stopping dev server (PID: $PID)..."
        kill "$PID"
        sleep 2
        if ps -p "$PID" > /dev/null 2>&1; then
            echo "Force stopping..."
            kill -9 "$PID"
        fi
        stopped=true
        echo "Dev server stopped"
    else
        echo "PID file exists but process not running"
    fi
    rm -f .dev.pid
fi

# Also check and kill any process on the port
if lsof -t -i:$PORT > /dev/null 2>&1; then
    echo "Found process still running on port $PORT..."
    kill_port_process $PORT
    stopped=true
    echo "Port $PORT is now free"
fi

# Try to kill orphan next dev processes in this project only
PROJECT_DIR=$(pwd)
orphan_pids=$(pgrep -f "next dev" 2>/dev/null)
if [ -n "$orphan_pids" ]; then
    for pid in $orphan_pids; do
        # Check if process is related to this project
        cwd=$(readlink -f /proc/"$pid"/cwd 2>/dev/null)
        if [ "$cwd" = "$PROJECT_DIR" ]; then
            kill "$pid" 2>/dev/null
            sleep 2
            if ps -p "$pid" > /dev/null 2>&1; then
                echo "Force killing orphan next dev process: $pid"
                kill -9 "$pid" 2>/dev/null
                sleep 1
            fi
            if ! ps -p "$pid" > /dev/null 2>&1; then
                echo "Killed orphan next dev process: $pid"
                stopped=true
            else
                echo "Failed to kill orphan next dev process: $pid"
            fi
        fi
    done
fi

if [ "$stopped" = false ]; then
    echo "Dev server is not running"
fi
