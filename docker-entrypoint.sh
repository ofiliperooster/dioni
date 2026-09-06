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

if [ -z "${INITIAL_ADMIN_EMAIL:-}" ] || [ -z "${INITIAL_ADMIN_PASSWORD:-}" ]; then
  echo "INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD are required" >&2
  exit 1
fi

umask 077
printf 'SUPABASE_URL=%s\nSUPABASE_INTERNAL_URL=%s\nSUPABASE_SERVICE_ROLE_KEY=%s\nINITIAL_ADMIN_EMAIL=%s\nINITIAL_ADMIN_PASSWORD=%s\n' \
  "$SUPABASE_URL" \
  "${SUPABASE_INTERNAL_URL:-$SUPABASE_URL}" \
  "$SERVICE_KEY" \
  "$INITIAL_ADMIN_EMAIL" \
  "$INITIAL_ADMIN_PASSWORD" > dist/server/.dev.vars

exec ./node_modules/.bin/wrangler dev \
  --ip 0.0.0.0 \
  --port 3000 \
  --config dist/server/wrangler.json
