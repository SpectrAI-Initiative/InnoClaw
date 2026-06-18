#!/bin/bash

# InnoClaw Dev Start Script
cd "$(dirname "$0")"

PORT=3000

server_responding() {
    command -v curl >/dev/null 2>&1 || return 1
    local status
    status=$(curl --noproxy "*" -fsS -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/api/auth/me" 2>/dev/null) || return 1
    [ "$status" = "200" ] || [ "$status" = "401" ]
}

pid_elapsed_seconds() {
    ps -p "$1" -o etimes= 2>/dev/null | tr -d ' '
}

pid_workdir() {
    readlink "/proc/$1/cwd" 2>/dev/null
}

is_repo_dev_process() {
    local pid=$1
    local cwd=$(pid_workdir "$pid")
    local cmdline=$(ps -p "$pid" -o args= 2>/dev/null)
    [ "$cwd" = "$PWD" ] && echo "$cmdline" | grep -qE "(npm run dev|next dev|node.*next)"
}

# Check if already running
if [ -f .dev.pid ]; then
    PID=$(cat .dev.pid)
    if ! echo "$PID" | grep -qE '^[0-9]+$'; then
        echo "Invalid PID in .dev.pid, removing file"
        rm -f .dev.pid
    elif ps -p "$PID" > /dev/null 2>&1; then
        if ! is_repo_dev_process "$PID"; then
            PID_CWD=$(pid_workdir "$PID")
            echo ".dev.pid points to a live non-server process (PID: $PID${PID_CWD:+, cwd: $PID_CWD}). Removing stale file."
            rm -f .dev.pid
        elif server_responding; then
            echo "Dev server is already running (PID: $PID)"
            exit 0
        else
            PID_AGE=$(pid_elapsed_seconds "$PID")
            if [ -n "$PID_AGE" ] && [ "$PID_AGE" -le 30 ]; then
                echo "Dev server is still starting (PID: $PID, age: ${PID_AGE}s)"
                exit 0
            fi

            echo "Dev server PID $PID is not healthy. Restarting it..."
            kill "$PID" 2>/dev/null
            sleep 2
            if ps -p "$PID" > /dev/null 2>&1; then
                echo "Force killing stale dev server..."
                kill -9 "$PID" 2>/dev/null
                sleep 1
            fi
            rm -f .dev.pid
        fi
    else
        rm -f .dev.pid
    fi
fi

# Check if port is occupied
check_port() {
    local port=$1
    local pids=$(lsof -t -i:$port 2>/dev/null)
    if [ -n "$pids" ]; then
        echo "Port $port is occupied by process: $pids"
        for pid in $pids; do
            local process_name=$(ps -p "$pid" -o comm= 2>/dev/null)
            local cmdline=$(ps -p "$pid" -o args= 2>/dev/null)
            echo "Process $pid: ${process_name:-unknown} ${cmdline:+($cmdline)}"
        done
        return 0
    fi
    return 1
}

port_owned_by_pid_file() {
    local port=$1
    [ -f .dev.pid ] || return 1
    local expected_pid=$(cat .dev.pid)
    echo "$expected_pid" | grep -qE '^[0-9]+$' || return 1
    is_repo_dev_process "$expected_pid" || return 1

    local pids=$(lsof -t -i:$port 2>/dev/null)
    [ -n "$pids" ] || return 1
    for pid in $pids; do
        if [ "$pid" = "$expected_pid" ]; then
            return 0
        fi
    done
    return 1
}

# Check and resolve port conflict
if check_port $PORT; then
    if port_owned_by_pid_file $PORT && server_responding; then
        echo "Dev server is already running (PID: $(cat .dev.pid))"
        exit 0
    fi
    echo "Error: Port $PORT is already in use by a process not managed by this repo's .dev.pid."
    echo "Stop that process or remove the conflict before running dev-start.sh."
    exit 1
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
