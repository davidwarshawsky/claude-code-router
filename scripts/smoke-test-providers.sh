#!/usr/bin/env bash
# smoke-test-providers.sh
# Sends one minimal /v1/messages request per provider+model and prints a pass/fail matrix.
# Assumes CCR is already running on $CCR_HOST:$CCR_PORT with $CCR_APIKEY.
#
# Usage:
#   ./scripts/smoke-test-providers.sh                # uses defaults 127.0.0.1:3456, key "test"
#   CCR_PORT=4000 CCR_APIKEY=mykey ./scripts/smoke-test-providers.sh
#   ./scripts/smoke-test-providers.sh cloudflare-large   # test only this provider

set -euo pipefail

HOST="${CCR_HOST:-127.0.0.1}"
PORT="${CCR_PORT:-3456}"
APIKEY="${CCR_APIKEY:-test}"
BASE="http://${HOST}:${PORT}"
TIMEOUT="${CCR_TIMEOUT:-30}"
FILTER="${1:-}"

passed=0
failed=0
skipped=0
results=()

# ── helpers ──────────────────────────────────────────────────────────────────

log()  { printf "\033[0;34m[info]\033[0m  %s\n" "$*"; }
ok()   { printf "\033[0;32m[pass]\033[0m  %s\n" "$*"; }
fail() { printf "\033[0;31m[FAIL]\033[0m  %s\n" "$*"; }
skip() { printf "\033[0;33m[skip]\033[0m  %s\n" "$*"; }
bold() { printf "\033[1m%s\033[0m\n" "$*"; }

# ── preflight: is CCR reachable? ─────────────────────────────────────────────

if ! curl -sf "${BASE}/api/config" -H "x-api-key: ${APIKEY}" >/dev/null 2>&1; then
  fail "CCR is not reachable at ${BASE}. Start it first (ccr start / node dist/cli.js start)."
  exit 1
fi
log "CCR reachable at ${BASE}"

# ── discover providers ───────────────────────────────────────────────────────

providers_json=$(curl -sf "${BASE}/providers" -H "x-api-key: ${APIKEY}")
if [ -z "$providers_json" ] || [ "$providers_json" = "[]" ]; then
  fail "No providers registered."
  exit 1
fi

provider_count=$(echo "$providers_json" | node -e "
  const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  console.log(d.length);
")
log "Found ${provider_count} provider(s)"

# ── iterate providers ────────────────────────────────────────────────────────

# ── iterate providers ────────────────────────────────────────────────────────

provider_list=$(node -e "
  const providers = JSON.parse(process.argv[1]);
  for (const p of providers) {
    const name = p.name || p.id || 'unknown';
    const models = p.models || [];
    const model = models[0] || '';
    console.log(name + '\t' + model);
  }
" "$providers_json")

while IFS=$'\t' read -r pname model; do
  # optional filter
  if [ -n "$FILTER" ] && [ "$pname" != "$FILTER" ]; then
    skip "${pname} (filtered out)"
    skipped=$((skipped + 1))
    continue
  fi

  if [ -z "$model" ]; then
    skip "${pname}: no models configured"
    skipped=$((skipped + 1))
    continue
  fi

  target="${pname},${model}"
  log "Testing ${target} ..."

  body="{\"model\":\"${target}\",\"max_tokens\":16,\"messages\":[{\"role\":\"user\",\"content\":\"Say OK\"}]}"

  http_code=$(curl -s -o /tmp/ccr_smoke_body.json -w "%{http_code}" \
    -X POST "${BASE}/v1/messages" \
    -H "Content-Type: application/json" \
    -H "x-api-key: ${APIKEY}" \
    -H "anthropic-version: 2023-06-01" \
    --max-time "$TIMEOUT" \
    -d "$body" 2>/dev/null || echo "000")

  if [ "$http_code" = "200" ]; then
    ok "${target}  HTTP ${http_code}"
    passed=$((passed + 1))
  else
    err=$(head -c 300 /tmp/ccr_smoke_body.json 2>/dev/null || echo "(no body)")
    fail "${target}  HTTP ${http_code}  ${err}"
    failed=$((failed + 1))
  fi
done <<< "$provider_list"

# ── summary ──────────────────────────────────────────────────────────────────

echo ""
bold "═══════════════════════════════════════════"
bold "  Provider Smoke Test Results"
bold "═══════════════════════════════════════════"
printf "  Passed:  %d\n" "$passed"
printf "  Failed:  %d\n" "$failed"
printf "  Skipped: %d\n" "$skipped"
bold "═══════════════════════════════════════════"

if [ "$failed" -gt 0 ]; then
  exit 1
fi
