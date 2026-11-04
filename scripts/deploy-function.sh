#!/usr/bin/env bash
# Deploy one Edge Function with the right JWT setting (gateway check).
# Functions called without a user session MUST skip the JWT check: the cron (publisher), OAuth callbacks (social),
# Stripe (stripe-webhook) and the database trigger (notify-signup). Deploying them without --no-verify-jwt breaks them.
set -euo pipefail
fn="${1:?usage: scripts/deploy-function.sh <function>}"
case "$fn" in
  publisher|social|stripe-webhook|notify-signup|llm-health) flag=--no-verify-jwt ;;
  *) flag= ;;
esac
npx supabase functions deploy "$fn" --project-ref hubkgvfiiszthzqyfguf $flag --yes
