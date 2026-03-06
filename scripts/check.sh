#!/usr/bin/env bash
set -euo pipefail

PASS=0
FAIL=0
WARN=0

check() {
  local label="$1"
  local result="$2"
  if [ "$result" = "0" ]; then
    echo "  [PASS] $label"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] $label"
    FAIL=$((FAIL + 1))
  fi
}

warn() {
  local label="$1"
  echo "  [WARN] $label"
  WARN=$((WARN + 1))
}

echo "=== Quality Gate Check ==="
echo ""

# Check required docs exist
echo "--- Documentation ---"
for doc in HYPOTHESIS.md SCOPE.md ARCHITECTURE.md TASKS.yaml; do
  if [ -f "docs/$doc" ]; then
    check "$doc exists" 0
  else
    check "$doc exists" 1
  fi
done

# Check no secrets in code
echo ""
echo "--- Security ---"
if grep -rqn "PRIVATE_KEY\s*=\s*['\"]" --include="*.ts" --include="*.js" --include="*.sol" . 2>/dev/null; then
  check "No hardcoded secrets" 1
else
  check "No hardcoded secrets" 0
fi

if [ -f ".env" ] && grep -q ".env" .gitignore 2>/dev/null; then
  check ".env is gitignored" 0
elif [ ! -f ".env" ]; then
  check ".env is gitignored (no .env file)" 0
else
  check ".env is gitignored" 1
fi

# Check git status
echo ""
echo "--- Repository ---"
if git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
  check "Git repository initialized" 0
else
  check "Git repository initialized" 1
fi

# Check if contracts compile (if they exist)
echo ""
echo "--- Build ---"
if [ -f "contracts/foundry.toml" ]; then
  if forge build --root contracts > /dev/null 2>&1; then
    check "Contracts compile" 0
  else
    check "Contracts compile" 1
  fi
else
  warn "No contracts directory with foundry.toml found"
fi

if [ -f "package.json" ]; then
  if npm run build > /dev/null 2>&1; then
    check "Frontend builds" 0
  else
    check "Frontend builds" 1
  fi
else
  warn "No package.json found"
fi

# Summary
echo ""
echo "=== Summary ==="
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
echo "  Warnings: $WARN"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "Quality gate: FAILED"
  exit 1
else
  echo "Quality gate: PASSED"
  exit 0
fi
