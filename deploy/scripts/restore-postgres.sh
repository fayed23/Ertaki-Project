#!/usr/bin/env bash
# Restore a gzipped pg_dump into the compose Postgres service.
# WARNING: replaces data in POSTGRES_DB.
set -euo pipefail

DUMP="${1:-}"
if [ -z "$DUMP" ] || [ ! -f "$DUMP" ]; then
  echo "Usage: $0 path/to/ertaki-YYYYMMDD.sql.gz" >&2
  exit 1
fi

echo "Restoring $DUMP into compose postgres (${POSTGRES_DB:-ertaki})…"
gunzip -c "$DUMP" | docker compose exec -T postgres \
  psql -U "${POSTGRES_USER:-ertaki}" -d "${POSTGRES_DB:-ertaki}"
echo "Restore finished. Restart api: docker compose restart api"
