#!/usr/bin/env bash
set -euo pipefail

# Matthew account (Cloudflare)
export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-919afe3537f94cf9e3f7ae41ef8e7e5c}"

# Required: provide API token via environment (do NOT hardcode secrets)
# Example:
#   export CLOUDFLARE_API_TOKEN="cfat_xxx"
: "${CLOUDFLARE_API_TOKEN:?Missing CLOUDFLARE_API_TOKEN}"

# Ensure SEO canonicals/hreflang are generated for production domain
export SITE_URL="${SITE_URL:-https://lotusia.org}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${MARKETING_DIR}"
npm run build
npx wrangler pages deploy dist/ --project-name=lotusia-marketing --branch=main

echo "Deploy complete for ${SITE_URL}"
