#!/bin/bash
#
# sync-secrets.sh — Pull secrets from GCP Secret Manager and set them as
# Vercel environment variables for the pledgebond project.
#
# Prerequisites:
#   - gcloud CLI authenticated with access to pledgebond project
#   - Vercel CLI installed and linked to the project
#   - GCP Secret Manager API enabled
#
# Usage:
#   ./scripts/sync-secrets.sh              # sync all secrets
#   ./scripts/sync-secrets.sh --dry-run    # show what would be synced
#
# Secrets are mapped: GCP secret name → Vercel env var name
# New secrets can be added to the SECRET_NAMES and SECRET_VARS arrays below.

set -euo pipefail

GCP_PROJECT="pledgebond"
DRY_RUN=false

if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "=== DRY RUN — no changes will be made ==="
fi

# Map: gcp-secret-name → VERCEL_ENV_VAR_NAME
# (using parallel arrays for bash 3.x compatibility)
SECRET_NAMES=(
  "circle-api-key"
  "circle-entity-secret"
  "circle-wallet-set-id"
  "circle-webhook-secret"
  "circle-platform-wallet-id"
  "circle-agent-wallet-id"
  "firebase-private-key"
  "firebase-client-email"
  "github-token"
  "agent-api-key"
  "featherless-api-key"
)

SECRET_VARS=(
  "CIRCLE_API_KEY"
  "CIRCLE_ENTITY_SECRET"
  "CIRCLE_WALLET_SET_ID"
  "CIRCLE_WEBHOOK_SECRET"
  "CIRCLE_PLATFORM_WALLET_ID"
  "CIRCLE_AGENT_WALLET_ID"
  "FIREBASE_PRIVATE_KEY"
  "FIREBASE_CLIENT_EMAIL"
  "GITHUB_TOKEN"
  "AGENT_API_KEY"
  "FEATHERLESS_API_KEY"
)

# Non-secret env vars that should also be set
CONFIG_NAMES=(
  "FIREBASE_PROJECT_ID"
  "CIRCLE_ENVIRONMENT"
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"
  "NEXT_PUBLIC_SOLANA_CLUSTER"
  "NEXT_PUBLIC_SOLANA_PROGRAM_ID"
  "LIQUIDITY_RAIL_ADDRESS"
  "ALLOW_DEMO_PAYMENTS"
)

CONFIG_VALUES=(
  "pledgebond"
  "sandbox"
  "pledgebond"
  "pledgebond.firebaseapp.com"
  "devnet"
  "DVzV16mVG9vHdrum9Fx9kGhzRv2GJa2mNnmTWUnKa6st"
  "0x26272b687df2c3607aCa3B6116c24B7400c3fC94"
  "false"
)

echo ""
echo "Syncing secrets from GCP Secret Manager → Vercel..."
echo "Project: $GCP_PROJECT"
echo ""

# Sync secrets
for i in "${!SECRET_NAMES[@]}"; do
  gcp_name="${SECRET_NAMES[$i]}"
  vercel_name="${SECRET_VARS[$i]}"

  # Read the latest version from Secret Manager
  value=$(gcloud secrets versions access latest \
    --secret="$gcp_name" \
    --project="$GCP_PROJECT" 2>/dev/null || echo "")

  if [[ -z "$value" ]]; then
    echo "  SKIP  $gcp_name → $vercel_name (secret not populated yet)"
    continue
  fi

  if $DRY_RUN; then
    echo "  WOULD SET $vercel_name (from $gcp_name)"
  else
    # Remove existing value first (ignore errors if not set)
    vercel env rm "$vercel_name" production 2>/dev/null || true
    # Set new value
    echo "$value" | vercel env add "$vercel_name" production 2>/dev/null
    echo "  OK    $vercel_name ← $gcp_name"
  fi
done

echo ""

# Sync non-secret config
for i in "${!CONFIG_NAMES[@]}"; do
  var_name="${CONFIG_NAMES[$i]}"
  var_value="${CONFIG_VALUES[$i]}"

  if $DRY_RUN; then
    echo "  WOULD SET $var_name=$var_value"
  else
    vercel env rm "$var_name" production 2>/dev/null || true
    echo "$var_value" | vercel env add "$var_name" production 2>/dev/null
    echo "  OK    $var_name=$var_value"
  fi
done

echo ""
echo "Done. Redeploy with: vercel --prod"

