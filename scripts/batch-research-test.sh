#!/usr/bin/env bash
# ==============================================================================
# batch-research-test.sh
# Batch test deep-research (vibe-research) capability via local API.
#
# Usage:
#   ./scripts/batch-research-test.sh [--base-url URL] [--concurrency N]
#
# Prerequisites:
#   - Next.js dev server running (npm run dev)
#   - jq installed (brew install jq)
#   - curl installed
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/lib/utils.sh"

# ── Configurable ──────────────────────────────────────────────────────────────
BASE_URL="${BASE_URL:-http://localhost:3000}"
CONCURRENCY="${CONCURRENCY:-5}"
POLL_INTERVAL=10            # seconds between status polls
MAX_POLL_TIME=1800          # 30 min timeout per session
WORKSPACE_NAME="batch-test-$(date +%Y%m%d-%H%M%S)"
WORKSPACE_FOLDER="/tmp/innoclaw-batch-test/${WORKSPACE_NAME}"
LOG_DIR="./batch-test-logs/${WORKSPACE_NAME}"

# ── Parse CLI args ────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --base-url)  BASE_URL="$2";     shift 2 ;;
    --concurrency) CONCURRENCY="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# ── Validate CONCURRENCY ──────────────────────────────────────────────────────
if ! [[ "$CONCURRENCY" =~ ^[0-9]+$ ]] || [[ "$CONCURRENCY" -le 0 ]]; then
  echo "Error: --concurrency must be a positive integer (got '${CONCURRENCY}')"
  exit 1
fi

API="${BASE_URL}/api"

# ── Test Cases ────────────────────────────────────────────────────────────────
# Each entry: "title|||content"
TEST_CASES=(
  "DQN vs PPO on Atari|||Compare the performance of DQN and PPO algorithms on the Atari game benchmark suite. Analyze sample efficiency, final performance, and training stability across at least 5 Atari games. Include wall-clock training time comparisons."

  "Transformer vs LSTM for Time Series|||Investigate whether Transformer-based models outperform LSTM networks for multivariate time series forecasting. Focus on datasets like ETTh1, Weather, and Electricity. Compare MAE, MSE, and inference latency."

  "Impact of Data Augmentation on Small Image Datasets|||Study the effect of different data augmentation strategies (CutMix, MixUp, RandAugment, AutoAugment) on CIFAR-10 classification accuracy when training with limited data (1k, 5k, 10k samples). Use ResNet-18 as the backbone."

  "GNN vs MLP for Molecular Property Prediction|||Compare Graph Neural Networks (GCN, GAT, GIN) against standard MLPs for molecular property prediction on the ESOL and FreeSolv datasets from MoleculeNet. Evaluate RMSE, R², and training cost."

  "LoRA vs Full Fine-tuning for LLM Adaptation|||Evaluate LoRA (Low-Rank Adaptation) against full fine-tuning for adapting a 7B parameter language model to domain-specific tasks. Compare on GSM8K (math), MMLU subsets, and a custom QA benchmark. Measure accuracy, memory usage, and training time."

  "Reward Shaping in Multi-Agent RL|||Analyze the impact of different reward shaping strategies on emergent cooperation in multi-agent reinforcement learning environments. Use MPE (Multi-Agent Particle Environment) cooperative navigation and predator-prey scenarios."

  "Diffusion Models vs GANs for Image Generation|||Compare the image generation quality of DDPM/DDIM diffusion models against StyleGAN2 on CIFAR-10 and CelebA-HQ. Evaluate FID, IS (Inception Score), and generation speed."

  "Curriculum Learning for Neural Machine Translation|||Investigate whether curriculum learning (ordering training examples by difficulty) improves neural machine translation performance. Test on WMT14 En-De and En-Fr using a standard Transformer architecture. Compare BLEU scores and convergence speed."

  "Self-Supervised Pre-training for Medical Imaging|||Evaluate self-supervised pre-training methods (SimCLR, BYOL, MAE) compared to ImageNet supervised pre-training for downstream medical image classification tasks (chest X-ray, dermoscopy). Measure AUC-ROC with varying amounts of labeled data."

  "Hyperparameter Optimization: Bayesian vs Random Search|||Compare Bayesian optimization (TPE, GP-based) against random search for hyperparameter tuning of a ResNet-50 on CIFAR-100. Track best validation accuracy over wall-clock time and number of trials."
)

NUM_CASES=${#TEST_CASES[@]}
log "Loaded ${NUM_CASES} test cases, concurrency=${CONCURRENCY}"

# ── Pre-flight checks ────────────────────────────────────────────────────────
if ! command -v jq &>/dev/null; then
  err "jq is required. Install with: brew install jq"
  exit 1
fi

# Check server is reachable
if ! curl -sf "${BASE_URL}" -o /dev/null 2>/dev/null; then
  err "Cannot reach ${BASE_URL}. Is the dev server running? (npm run dev)"
  exit 1
fi

# ── Create workspace folder & workspace ───────────────────────────────────────
mkdir -p "${WORKSPACE_FOLDER}"
mkdir -p "${LOG_DIR}"

log "Creating workspace: ${WORKSPACE_NAME}"
log "Folder: ${WORKSPACE_FOLDER}"

WS_RESP=$(curl -s -X POST "${API}/workspaces" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg name "$WORKSPACE_NAME" --arg fp "$WORKSPACE_FOLDER" \
    '{name: $name, folderPath: $fp}')")

WORKSPACE_ID=$(echo "$WS_RESP" | jq -r '.id')
if [[ -z "$WORKSPACE_ID" || "$WORKSPACE_ID" == "null" ]]; then
  err "Failed to create workspace: ${WS_RESP}"
  exit 1
fi
ok "Workspace created: ${WORKSPACE_ID}"

# ── Per-session runner function ───────────────────────────────────────────────
run_session() {
  local idx=$1
  local entry="${TEST_CASES[$idx]}"
  local title="${entry%%|||*}"
  local content="${entry##*|||}"
  local log_file="${LOG_DIR}/session_$(printf '%02d' $idx)_$(echo "$title" | tr ' ' '_' | tr -cd 'A-Za-z0-9_-' | head -c 40).log"

  {
    echo "=== Test Case #${idx}: ${title} ==="
    echo "Started: $(date)"
    echo ""

    # 1) Create session
    local sess_resp
    sess_resp=$(curl -s -X POST "${API}/deep-research/sessions" \
      -H "Content-Type: application/json" \
      -d "$(jq -n \
        --arg ws "$WORKSPACE_ID" \
        --arg t "$title" \
        --arg c "$content" \
        '{workspaceId: $ws, title: $t, content: $c}')")

    local session_id
    session_id=$(echo "$sess_resp" | jq -r '.id')
    if [[ -z "$session_id" || "$session_id" == "null" ]]; then
      echo "FAIL: Could not create session: ${sess_resp}"
      return 1
    fi
    echo "Session created: ${session_id}"

    # 2) Start orchestrator run
    local run_resp
    run_resp=$(curl -s -X POST "${API}/deep-research/sessions/${session_id}/run")
    echo "Run started: ${run_resp}"

    # Check if run start failed
    local run_error
    run_error=$(echo "$run_resp" | jq -r '.error // empty')
    if [[ -n "$run_error" ]]; then
      echo "FAIL: Could not start run: ${run_error}"
      return 1
    fi

    # 3) Poll until terminal state, auto-confirming checkpoints
    local elapsed=0
    local status=""
    local final_status=""
    local last_confirmed_id=""

    while [[ $elapsed -lt $MAX_POLL_TIME ]]; do
      sleep "$POLL_INTERVAL"
      elapsed=$((elapsed + POLL_INTERVAL))

      local sess_data
      sess_data=$(curl -sf "${API}/deep-research/sessions/${session_id}" 2>/dev/null || echo '{}')
      status=$(echo "$sess_data" | jq -r '.status // "unknown"')

      # Terminal states (matches SessionStatus in types.ts)
      if [[ "$status" == "completed" || "$status" == "failed" || "$status" == "stopped_by_user" || "$status" == "cancelled" ]]; then
        final_status="$status"
        echo "[${elapsed}s] Terminal status: ${status}"
        break
      fi

      # Auto-confirm checkpoints — use pendingCheckpointId from session data
      if [[ "$status" == "awaiting_user_confirmation" ]]; then
        local checkpoint_id
        checkpoint_id=$(echo "$sess_data" | jq -r '.pendingCheckpointId // empty')
        if [[ -n "$checkpoint_id" && "$checkpoint_id" != "${last_confirmed_id:-}" ]]; then
          echo "[${elapsed}s] Auto-confirming checkpoint ${checkpoint_id}..."
          local confirm_resp
          confirm_resp=$(curl -sf -X POST "${API}/deep-research/sessions/${session_id}/confirm" \
            -H "Content-Type: application/json" \
            -d "$(jq -n --arg nid "$checkpoint_id" '{nodeId: $nid, outcome: "confirmed"}')" \
            2>/dev/null || echo '{"error":"confirm failed"}')
          echo "  confirm: ${confirm_resp}"
          last_confirmed_id="$checkpoint_id"
        fi
      fi

      # Auto-approve execution steps — find from nodes list
      if [[ "$status" == "awaiting_approval" ]]; then
        echo "[${elapsed}s] Awaiting approval — auto-approving..."
        local nodes
        nodes=$(curl -sf "${API}/deep-research/sessions/${session_id}/nodes" 2>/dev/null || echo '[]')
        api_auto_action "$API" "$session_id" "$nodes" \
          '[.[] | select(.status == "awaiting_approval")] | first | .id // empty' \
          "approve" '{"approved":true}' || true
      fi

      echo "[${elapsed}s] status=${status}"
    done

    if [[ -z "$final_status" ]]; then
      final_status="timeout"
      echo "TIMEOUT after ${MAX_POLL_TIME}s (last status: ${status})"
    fi

    # 4) Export report if completed
    if [[ "$final_status" == "completed" ]]; then
      local export_resp
      export_resp=$(curl -sf -X POST "${API}/deep-research/sessions/${session_id}/export" \
        -H "Content-Type: application/json" -d '{}' 2>/dev/null || echo '{"error":"export failed"}')
      echo "Export: ${export_resp}"
    fi

    echo ""
    echo "Finished: $(date)"
    echo "Final status: ${final_status}"
    echo "Session ID: ${session_id}"

  } > "$log_file" 2>&1

  # Print summary to stdout
  local final
  final=$(tail -1 "$log_file" | grep -o 'Session ID:.*' || echo "check log")
  local fstatus
  fstatus=$(grep 'Final status:' "$log_file" | tail -1 | awk '{print $NF}')

  case "$fstatus" in
    completed) ok "[#${idx}] ${title} → ${fstatus}  (${final})" ;;
    failed)    err "[#${idx}] ${title} → ${fstatus}  (${final})" ;;
    timeout)   warn "[#${idx}] ${title} → ${fstatus}  (${final})" ;;
    *)         warn "[#${idx}] ${title} → ${fstatus:-unknown}  (${final})" ;;
  esac
}

# ── Run with concurrency control ─────────────────────────────────────────────
log "Starting ${NUM_CASES} research sessions (max ${CONCURRENCY} concurrent)..."
echo ""

# Reap finished children and compact the active_pids array.
reap_children() {
  local new_pids=()
  local pid
  for pid in "${active_pids[@]+"${active_pids[@]}"}"; do
    if kill -0 "$pid" 2>/dev/null; then
      new_pids+=("$pid")
    else
      wait "$pid" 2>/dev/null || true
    fi
  done
  active_pids=("${new_pids[@]+"${new_pids[@]}"}")
}

active_pids=()

for i in $(seq 0 $((NUM_CASES - 1))); do
  # Wait if we've hit the concurrency limit
  while true; do
    reap_children
    [[ ${#active_pids[@]} -lt $CONCURRENCY ]] && break
    sleep 1
  done

  local_title="${TEST_CASES[$i]%%|||*}"
  log "Launching [#${i}] ${local_title}"
  run_session "$i" &
  active_pids+=($!)

  # Stagger launches slightly to avoid thundering herd
  sleep 2
done

# Wait for all remaining
wait

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════════"
log "BATCH TEST COMPLETE"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "  Workspace:  ${WORKSPACE_NAME}  (ID: ${WORKSPACE_ID})"
echo "  Test cases: ${NUM_CASES}"
echo "  Logs:       ${LOG_DIR}/"
echo ""

# Count results
completed=$( { grep -l "Final status: completed" "${LOG_DIR}"/*.log 2>/dev/null || true; } | wc -l | tr -d ' ')
failed=$( { grep -l "Final status: failed" "${LOG_DIR}"/*.log 2>/dev/null || true; } | wc -l | tr -d ' ')
timeout=$( { grep -l "Final status: timeout" "${LOG_DIR}"/*.log 2>/dev/null || true; } | wc -l | tr -d ' ')

echo -e "  ${GREEN}Completed: ${completed}${NC}"
echo -e "  ${RED}Failed:    ${failed}${NC}"
echo -e "  ${YELLOW}Timeout:   ${timeout}${NC}"
echo ""
echo "  Reports exported to: ${WORKSPACE_FOLDER}/deep-research-reports/"
echo ""
