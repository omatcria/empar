#!/usr/bin/env bash
# Executa SQL no projeto App Finanças via Supabase Management API.
# Uso: scripts/supabase/sbq.sh "<SQL>"   ou   scripts/supabase/sbq.sh -f arquivo.sql
# O token é lido de .mcp.json (git-ignored) na raiz do repo e NUNCA é impresso.
# Sai com código != 0 quando a API responde erro (o corpo do erro é impresso).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REF=gkzstunjcftvqoljgvce

if [ "${1:-}" = "-f" ]; then
  [ -n "${2:-}" ] || { echo "uso: $0 -f arquivo.sql" >&2; exit 2; }
  SQL=$(cat "$2")
else
  [ -n "${1:-}" ] || { echo "uso: $0 \"<SQL>\" | -f arquivo.sql" >&2; exit 2; }
  SQL="$1"
fi

TOKEN=$(cd "$ROOT" && node -e "const c=JSON.parse(require('fs').readFileSync('.mcp.json','utf8'));process.stdout.write(c.mcpServers.supabase.env.SUPABASE_ACCESS_TOKEN)")

# Corpo JSON montado pelo node e enviado via stdin (sem limite de tamanho de argv).
printf '%s' "$SQL" \
  | node -e "let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.stringify({query:s})))" \
  | curl -sS --fail-with-body -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
      -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data-binary @-
echo
