#!/usr/bin/env bash
# Destructive restore from a gzipped (or .gpg) dump produced by backup-postgres.sh.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT/docker-compose.yml}"
FILE="${1:-}"

if [ -z "$FILE" ]; then
  echo "Usage: $0 deploy/backups/ertaki-YYYYMMDDT….sql.gz[.gpg]" >&2
  exit 1
fi

if [ ! -f "$FILE" ]; then
  echo "Missing dump: $FILE" >&2
  exit 1
fi

cd "$ROOT"
TMP="$FILE"
CLEANUP=""
if [[ "$FILE" == *.gpg ]]; then
  TMP="$(mktemp)"
  CLEANUP="$TMP"
  gpg --batch --yes --decrypt -o "$TMP" "$FILE"
fi

echo "Restoring $FILE into compose postgres (destructive)…"
gunzip -c "$TMP" | docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U "${POSTGRES_USER:-ertaki}" -d "${POSTGRES_DB:-ertaki}"

if [ -n "$CLEANUP" ]; then rm -f "$CLEANUP"; fi

docker compose -f "$COMPOSE_FILE" restart api
echo "Restore complete. Verify: curl -fsS https://\$DOMAIN/api/health"
