#!/usr/bin/env bash
# Postgres dump into deploy/backups with retention + optional gpg encryption.
# Encrypt off-site copy separately when GPG_RECIPIENT is unset (restic / object storage).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/deploy/backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$BACKUP_DIR/ertaki-${STAMP}.sql.gz"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT/docker-compose.yml}"

mkdir -p "$BACKUP_DIR"
cd "$ROOT"

dump_via_compose() {
  docker compose -f "$COMPOSE_FILE" exec -T postgres \
    pg_dump -U "${POSTGRES_USER:-ertaki}" "${POSTGRES_DB:-ertaki}"
}

if docker compose -f "$COMPOSE_FILE" ps --status running 2>/dev/null | grep -q postgres; then
  echo "Dumping via docker compose postgres…"
  dump_via_compose | gzip -c > "$FILE"
elif [ -n "${DATABASE_URL:-}" ]; then
  echo "Dumping via pg_dump DATABASE_URL…"
  if command -v pg_dump >/dev/null 2>&1; then
    pg_dump "$DATABASE_URL" | gzip -c > "$FILE"
  else
    echo "pg_dump not found; falling back to compose exec if available." >&2
    dump_via_compose | gzip -c > "$FILE"
  fi
else
  echo "Postgres service not running. Start compose or set DATABASE_URL." >&2
  exit 1
fi

ln -sfn "$(basename "$FILE")" "$BACKUP_DIR/ertaki-latest.sql.gz"

if [ -n "${GPG_RECIPIENT:-}" ]; then
  echo "Encrypting for $GPG_RECIPIENT…"
  gpg --batch --yes --encrypt -r "$GPG_RECIPIENT" -o "${FILE}.gpg" "$FILE"
  echo "Wrote ${FILE}.gpg"
fi

# Retention: delete plain dumps older than KEEP_DAYS (keep latest symlink target).
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'ertaki-*.sql.gz' -mtime +"$KEEP_DAYS" -print -delete || true
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'ertaki-*.sql.gz.gpg' -mtime +"$KEEP_DAYS" -print -delete || true

echo "Wrote $FILE"
echo "Retention: ${KEEP_DAYS}d. Keep 3-2-1: copy encrypted dump off-box."
echo "Schedule nightly: 0 2 * * * cd $ROOT && ./deploy/scripts/backup-postgres.sh >>deploy/backups/backup.log 2>&1"
