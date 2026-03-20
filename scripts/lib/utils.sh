#!/usr/bin/env bash
# ==============================================================================
# Shared utilities for InnoClaw CLI scripts.
# Source this file: source "$(dirname "$0")/lib/utils.sh"
# ==============================================================================

# ── ANSI Colors ───────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; NC='\033[0m'

# ── Logging ───────────────────────────────────────────────────────────────────
log()  { echo -e "${CYAN}[$(date +%H:%M:%S)]${NC} $*"; }
ok()   { echo -e "${GREEN}[$(date +%H:%M:%S)] ✓${NC} $*"; }
warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)] ⚠${NC} $*"; }
err()  { echo -e "${RED}[$(date +%H:%M:%S)] ✗${NC} $*"; }

# ── API Helpers ───────────────────────────────────────────────────────────────

# Find a node matching a jq filter from nodes JSON, then POST to a session endpoint.
# Merges nodeId into the extra_json payload automatically.
#
# Usage:
#   auto_action "$base_api" "$session_id" "$nodes_json" "$jq_filter" "endpoint" '{"extra":"fields"}'
#
# Returns 0 if a node was found and the POST was issued, 1 otherwise.
api_auto_action() {
  local api=$1 sid=$2 nodes_json=$3 jq_filter=$4 endpoint=$5 extra_json=$6
  local node_id
  node_id=$(echo "$nodes_json" | jq -r "$jq_filter")
  if [[ -n "$node_id" && "$node_id" != "null" ]]; then
    local payload
    payload=$(echo "$extra_json" | jq --arg nid "$node_id" '. + {nodeId: $nid}')
    local resp
    resp=$(curl -s -X POST "${api}/deep-research/sessions/${sid}/${endpoint}" \
      -H "Content-Type: application/json" \
      -d "$payload" 2>/dev/null || echo '{"error":"'"$endpoint"' failed"}')
    echo "  ${endpoint} node ${node_id}: ${resp}"
    return 0
  fi
  return 1
}

# ── Process Management ────────────────────────────────────────────────────────
# Note: reap_children is defined inline in scripts that use concurrency control,
# since bash 3.2 (macOS default) lacks nameref support for pass-by-name arrays.
