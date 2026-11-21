#!/usr/bin/env bash
# Regenera src/lib/database.types.ts a partir do schema `public` do projeto
# (Supabase Management API). Token lido de .mcp.json (git-ignored), nunca impresso.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REF=gkzstunjcftvqoljgvce
OUT="$ROOT/src/lib/database.types.ts"

TOKEN=$(cd "$ROOT" && node -e "const c=JSON.parse(require('fs').readFileSync('.mcp.json','utf8'));process.stdout.write(c.mcpServers.supabase.env.SUPABASE_ACCESS_TOKEN)")

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
curl -sS --fail-with-body "https://api.supabase.com/v1/projects/$REF/types/typescript?included_schemas=public" \
  -H "Authorization: Bearer $TOKEN" -o "$TMP"

# Resposta: { "types": "<conteúdo do arquivo>" }
node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));if(typeof j.types!=='string')throw new Error('resposta sem campo types');fs.writeFileSync(process.argv[2],j.types)" "$TMP" "$OUT"
echo "ok: $OUT"
