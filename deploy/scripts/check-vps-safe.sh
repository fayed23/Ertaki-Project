#!/usr/bin/env bash
# Verify the running (or about-to-run) Compose config is VPS-safe:
# production Caddyfile, no LAN overlay, API not published on the host.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  echo "Usage: ./deploy/scripts/check-vps-safe.sh"
  echo "Fails if docker-compose.lan.yml / Caddyfile.lan would be active."
  exit 0
fi

CONFIG="$(docker compose -f docker-compose.yml config 2>/dev/null)" || {
  echo "ERROR: could not render docker compose config. Is Docker available?" >&2
  exit 1
}

fail=0

if echo "$CONFIG" | grep -q 'Caddyfile.lan'; then
  echo "FAIL: rendered config references Caddyfile.lan (LAN overlay active)." >&2
  fail=1
else
  echo "OK: Caddyfile.lan not in rendered config."
fi

if echo "$CONFIG" | grep -E 'source: .*/deploy/Caddyfile$' >/dev/null || \
   echo "$CONFIG" | grep -q 'deploy/Caddyfile:'; then
  echo "OK: production deploy/Caddyfile is mounted."
else
  # compose config may show bind target differently across versions
  if echo "$CONFIG" | grep -A2 'caddy:' | grep -q 'Caddyfile'; then
    echo "OK: a Caddyfile bind is present for caddy."
  else
    echo "WARN: could not confirm Caddyfile bind path in rendered config (check manually)."
  fi
fi

# API must not publish host ports in production compose.
api_ports="$(echo "$CONFIG" | awk '/^  api:/{p=1} p&&/^  [a-z]/{if(/^  api:/)next; else exit} p' | grep -E 'published:|ports:' || true)"
if echo "$CONFIG" | sed -n '/^  api:/,/^  [a-z]/p' | grep -q 'published:'; then
  echo "FAIL: api service publishes host ports (should be Caddy-only)." >&2
  fail=1
else
  echo "OK: api has no published host ports."
fi

if echo "$CONFIG" | sed -n '/^  caddy:/,/^  [a-z]/p' | grep -q 'published: "8080"\|published: 8080\|target: 8080'; then
  echo "FAIL: caddy publishes 8080 (LAN overlay leak)." >&2
  fail=1
else
  echo "OK: caddy does not publish LAN fallback port 8080."
fi

# Soft checks on .env if present
if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  set -a
  # parse KEY=VAL lines without executing
  while IFS= read -r line; do
    case "$line" in
      ''|\#*) continue ;;
      *=*)
        key="${line%%=*}"
        val="${line#*=}"
        val="${val%\"}"
        val="${val#\"}"
        export "$key=$val" 2>/dev/null || true
        ;;
    esac
  done < .env
  set +a

  if [[ "${SEED_ON_EMPTY:-false}" == "true" || "${ALLOW_DEMO_SEED:-false}" == "true" ]]; then
    echo "WARN: demo seeding flags are true — turn off on a public VPS."
  else
    echo "OK: demo seeding flags are not enabled."
  fi

  if [[ -z "${JWT_SECRET:-}" || ${#JWT_SECRET} -lt 32 ]]; then
    echo "WARN: JWT_SECRET missing or shorter than 32 chars."
  fi

  if [[ "${DOMAIN:-localhost}" == "localhost" ]]; then
    echo "WARN: DOMAIN=localhost (fine for smoke; use a real hostname for public HTTPS)."
  else
    echo "OK: DOMAIN=${DOMAIN}"
  fi

  api_url="${NEXT_PUBLIC_API_URL:-/api}"
  if [[ "$api_url" == "/api" || "$api_url" == "https://${DOMAIN}/api" ]]; then
    echo "OK: NEXT_PUBLIC_API_URL=${api_url} (compatible with VPS behind Caddy)."
  else
    echo "WARN: NEXT_PUBLIC_API_URL=${api_url} — prefer /api or https://${DOMAIN}/api"
  fi
else
  echo "WARN: no .env yet (copy from .env.example before deploy)."
fi

if [[ "$fail" -ne 0 ]]; then
  echo >&2
  echo "VPS safety check FAILED. Do not use -f docker-compose.lan.yml on a public server." >&2
  exit 1
fi

echo
echo "VPS safety check passed for base docker-compose.yml."
