#!/bin/sh
set -eu

if [ -z "${SUPABASE_URL:-}" ]; then
  echo "SUPABASE_URL is required" >&2
  exit 1
fi

SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-${SUPABASE_SECRET_KEY:-}}"
if [ -z "$SERVICE_KEY" ]; then
  echo "SUPABASE_SERVICE_ROLE_KEY is required" >&2
  exit 1
fi

umask 077
printf 'SUPABASE_URL=%s\nSUPABASE_SERVICE_ROLE_KEY=%s\n' "$SUPABASE_URL" "$SERVICE_KEY" > .dev.vars

exec ./node_modules/.bin/wrangler dev \
  --ip 0.0.0.0 \
  --port 3000 \
  --config dist/server/wrangler.json
