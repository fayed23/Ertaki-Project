#!/usr/bin/env bash
# Nightly-friendly Postgres dump into deploy/backups (or BACKUP_DIR).
# Encrypt off-site copy separately (gpg / restic / object storage).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/deploy/backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$BACKUP_DIR/ertaki-${STAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

if [ -n "${DATABASE_URL:-}" ]; then
  echo "Dumping via DATABASE_URL…"
  docker compose exec -T postgres pg_dump -U "${POSTGRES_USER:-ertaki}" "${POSTGRES_DB:-ertaki}" \
    | gzip -c > "$FILE"
elif docker compose ps --status running 2>/dev/null | grep -q postgres; then
  echo "Dumping via docker compose postgres…"
  docker compose exec -T postgres pg_dump -U "${POSTGRES_USER:-ertaki}" "${POSTGRES_DB:-ertaki}" \
    | gzip -c > "$FILE"
else
  echo "Postgres service not running. Start compose or set DATABASE_URL." >&2
  exit 1
fi

ln -sfn "$(basename "$FILE")" "$BACKUP_DIR/ertaki-latest.sql.gz"
echo "Wrote $FILE"
echo "Keep 3-2-1: copy encrypted dump off-box. See docs/vps-deploy.md restore notes."
