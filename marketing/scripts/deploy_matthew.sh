#!/usr/bin/env bash
set -euo pipefail

# Matthew account (Cloudflare)
export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-919afe3537f94cf9e3f7ae41ef8e7e5c}"
export PROJECT_NAME="${PROJECT_NAME:-lotusia-marketing}"
export ZONE_NAME="${ZONE_NAME:-lotusia.org}"
export SITE_URL="${SITE_URL:-https://lotusia.org}"

# Required: provide API token via environment (do NOT hardcode secrets)
# Example:
#   export CLOUDFLARE_API_TOKEN="cfat_xxx"
: "${CLOUDFLARE_API_TOKEN:?Missing CLOUDFLARE_API_TOKEN}"

# Optional cutover step (dangerous): switch apex/www DNS to Pages.
# To enable:
#   CUTOVER_APEX=1 CONFIRM_CUTOVER=YES ./scripts/deploy_matthew.sh
export CUTOVER_APEX="${CUTOVER_APEX:-0}"
export CONFIRM_CUTOVER="${CONFIRM_CUTOVER:-}"
export DRY_RUN="${DRY_RUN:-0}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
API_BASE="https://api.cloudflare.com/client/v4"

cf_api() {
  local method="$1"
  local path="$2"
  local data="${3:-}"
  if [ -n "$data" ]; then
    curl -sS -X "$method" "${API_BASE}${path}" \
      -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
      -H "Content-Type: application/json" \
      --data "$data"
  else
    curl -sS -X "$method" "${API_BASE}${path}" \
      -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
      -H "Content-Type: application/json"
  fi
}

cf_api_ok() {
  python -c "import json,sys; print('ok' if json.load(sys.stdin).get('success') else 'fail')"
}

json_pick() {
  local expr="$1"
  python -c "import json,sys; d=json.load(sys.stdin); print(${expr})"
}

run_or_echo() {
  if [ "$DRY_RUN" = "1" ]; then
    echo "[DRY_RUN] $*"
  else
    eval "$*"
  fi
}

echo "Verifying Cloudflare token..."
VERIFY_RES="$(cf_api GET "/accounts/${CLOUDFLARE_ACCOUNT_ID}/tokens/verify")"
if [ "$(printf "%s" "$VERIFY_RES" | cf_api_ok)" != "ok" ]; then
  echo "Token verification failed:"
  echo "$VERIFY_RES"
  exit 1
fi
echo "Token OK."

echo "Resolving zone id for ${ZONE_NAME}..."
ZONE_RES="$(cf_api GET "/zones?name=${ZONE_NAME}")"
ZONE_ID="$(printf "%s" "$ZONE_RES" | json_pick "((d.get('result') or [{}])[0].get('id') or '')")"
if [ -z "$ZONE_ID" ]; then
  echo "Could not resolve zone id for ${ZONE_NAME}"
  echo "$ZONE_RES"
  exit 1
fi
echo "Zone id: ${ZONE_ID}"

cd "${MARKETING_DIR}"
npm run build
npx wrangler pages deploy dist/ --project-name="${PROJECT_NAME}" --branch=main

if [ "$CUTOVER_APEX" = "1" ]; then
  if [ "$CONFIRM_CUTOVER" != "YES" ]; then
    echo "CUTOVER_APEX=1 requested, but CONFIRM_CUTOVER=YES not set. Aborting cutover."
    exit 1
  fi

  echo "Checking Pages project visibility via API..."
  PROJ_RES="$(cf_api GET "/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${PROJECT_NAME}")"
  if [ "$(printf "%s" "$PROJ_RES" | cf_api_ok)" != "ok" ]; then
    echo "Project '${PROJECT_NAME}' is not visible in this account/token."
    echo "$PROJ_RES"
    echo "Available projects in this account:"
    cf_api GET "/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects" | python -c "import json,sys; d=json.load(sys.stdin); print([x.get('name') for x in d.get('result',[])])"
    exit 1
  fi

  echo "Ensuring Pages domains exist (${ZONE_NAME}, www.${ZONE_NAME})..."
  run_or_echo "cf_api POST '/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/domains' '{\"name\":\"${ZONE_NAME}\"}' >/dev/null"
  run_or_echo "cf_api POST '/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/domains' '{\"name\":\"www.${ZONE_NAME}\"}' >/dev/null"

  echo "Preparing apex/www DNS cutover to ${PROJECT_NAME}.pages.dev ..."
  REC_RES="$(cf_api GET "/zones/${ZONE_ID}/dns_records?per_page=500")"
  # Delete A/AAAA/CNAME for apex and www to avoid conflicts, then create proxied CNAMEs.
  RECORD_IDS="$(python - "$REC_RES" <<'PY'
import json, sys
data = json.loads(sys.argv[1])
for r in data.get("result", []):
    if r.get("name") in ("lotusia.org", "www.lotusia.org") and r.get("type") in ("A", "AAAA", "CNAME"):
        print(r["id"])
PY
)"
  while read -r rec_id; do
    [ -z "$rec_id" ] && continue
    run_or_echo "cf_api DELETE '/zones/${ZONE_ID}/dns_records/${rec_id}' >/dev/null"
  done <<< "$RECORD_IDS"

  run_or_echo "cf_api POST '/zones/${ZONE_ID}/dns_records' '{\"type\":\"CNAME\",\"name\":\"${ZONE_NAME}\",\"content\":\"${PROJECT_NAME}.pages.dev\",\"proxied\":true}' >/dev/null"
  run_or_echo "cf_api POST '/zones/${ZONE_ID}/dns_records' '{\"type\":\"CNAME\",\"name\":\"www.${ZONE_NAME}\",\"content\":\"${PROJECT_NAME}.pages.dev\",\"proxied\":true}' >/dev/null"
  echo "Apex/www DNS cutover complete (or dry-run preview if DRY_RUN=1)."
fi

echo "Deploy complete for ${SITE_URL} (project: ${PROJECT_NAME})"
