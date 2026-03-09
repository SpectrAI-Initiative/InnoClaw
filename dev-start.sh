#!/bin/bash

# Jarvis Dev Start Script
cd "$(dirname "$0")"

PORT=3000

# Check if already running
if [ -f .dev.pid ]; then
    PID=$(cat .dev.pid)
    if ! echo "$PID" | grep -qE '^[0-9]+$'; then
        echo "Invalid PID in .dev.pid, removing file"
        rm -f .dev.pid
    elif ps -p "$PID" > /dev/null 2>&1; then
        echo "Dev server is already running (PID: $PID)"
        exit 1
    else
        rm -f .dev.pid
    fi
fi

# Check if port is occupied
check_port() {
    local port=$1
    local pid=$(lsof -t -i:$port 2>/dev/null)
    if [ -n "$pid" ]; then
        echo "Port $port is occupied by process: $pid"
        local process_name=$(ps -p $pid -o comm= 2>/dev/null)
        echo "Process name: $process_name"
        return 0
    fi
    return 1
}

kill_port_process() {
    local port=$1
    # Only kill node/next processes, not VSCode port forwarding
    local pids=$(lsof -t -i:$port 2>/dev/null)
    if [ -n "$pids" ]; then
        for pid in $pids; do
            local cmdline=$(ps -p $pid -o args= 2>/dev/null)
            # Skip VSCode related processes
            if echo "$cmdline" | grep -qE "(vscode|code-server|sshd)"; then
                echo "Skipping VSCode/SSH process: $pid ($cmdline)"
                continue
            fi
            # Only kill node/next related processes
            if echo "$cmdline" | grep -qE "(node|next|npm)"; then
                echo "Killing process $pid on port $port ($cmdline)..."
                kill $pid 2>/dev/null
                sleep 2
                if ps -p $pid > /dev/null 2>&1; then
                    echo "Force killing..."
                    kill -9 $pid 2>/dev/null
                    sleep 1
                fi
            fi
        done
        if lsof -t -i:$port > /dev/null 2>&1; then
            # Check if remaining process is VSCode
            local remaining=$(lsof -t -i:$port 2>/dev/null | head -1)
            local remaining_cmd=$(ps -p $remaining -o args= 2>/dev/null)
            if echo "$remaining_cmd" | grep -qE "(vscode|code-server|sshd)"; then
                echo "Port $port still used by VSCode (safe to ignore)"
                return 0
            fi
            echo "Failed to free port $port"
            return 1
        fi
        echo "Port $port is now free"
    fi
    return 0
}

# Check and resolve port conflict
if check_port $PORT; then
    echo "Attempting to free port $PORT..."
    if ! kill_port_process $PORT; then
        echo "Error: Could not free port $PORT. Please manually resolve."
        exit 1
    fi
fi

# Install dependencies if needed
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Run database migrations
echo "Running database migrations..."
npx drizzle-kit migrate 2>&1 | grep -v "^Reading config\|^No config"

# Create logs directory
mkdir -p logs

# Start dev server in background
echo "Starting dev server..."
nohup npm run dev > logs/dev.log 2>&1 &
echo $! > .dev.pid

echo "Dev server started (PID: $(cat .dev.pid))"
echo "Logs: logs/dev.log"
echo "URL: http://localhost:3000"
