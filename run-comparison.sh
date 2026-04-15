#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
VENV_DIR="${VENV_DIR:-$PROJECT_DIR/venv}"

FF_NAME="sana_rebrand_enabled"
TENANT="cruise"

if [ ! -f "$VENV_DIR/bin/activate" ]; then
  # Worktree: fall back to sibling checkout's venv
  VENV_DIR="$(dirname "$PROJECT_DIR")/vndly/venv"
fi

cd "$PROJECT_DIR"

toggle_ff() {
  local value_flag="$1"
  echo ""
  echo "══════════════════════════════════════════"
  echo "  Toggling $FF_NAME $value_flag for $TENANT"
  echo "══════════════════════════════════════════"
  source "$VENV_DIR/bin/activate"
  python manage.py update_feature_flag "$FF_NAME" "$value_flag" -s "$TENANT"
}

run_capture() {
  local phase="$1"
  echo ""
  echo "══════════════════════════════════════════"
  echo "  Running capture:$phase"
  echo "══════════════════════════════════════════"
  cd "$SCRIPT_DIR"
  npm run "capture:$phase"
  cd "$PROJECT_DIR"
}

echo "Starting visual regression comparison run..."
echo "Feature flag: $FF_NAME"
echo "Tenant: $TENANT"

# 1. FF off -> capture before
toggle_ff --false
run_capture before

# 2. FF on -> capture after
toggle_ff --true
run_capture after

# 3. Compare
echo ""
echo "══════════════════════════════════════════"
echo "  Running compare"
echo "══════════════════════════════════════════"
cd "$SCRIPT_DIR"
npm run compare

echo ""
echo "══════════════════════════════════════════"
echo "  Done! Check the report above."
echo "══════════════════════════════════════════"
