#!/usr/bin/env bash
set -euo pipefail
: "${SUPABASE_ACCESS_TOKEN:?Defina SUPABASE_ACCESS_TOKEN antes de executar}"
npx supabase@latest functions deploy wishlist-scrape --project-ref gkzstunjcftvqoljgvce --use-api
npx supabase@latest functions deploy wishlist-price-check --project-ref gkzstunjcftvqoljgvce --use-api --no-verify-jwt
npx supabase@latest functions deploy send-push --project-ref gkzstunjcftvqoljgvce --use-api --no-verify-jwt
