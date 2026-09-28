#!/usr/bin/env bash
# Prove backup → restore on a disposable Postgres container.
# Evidence is written to deploy/backups/RESTORE-PROOF.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
EVIDENCE="$ROOT/deploy/backups/RESTORE-PROOF.md"
STAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
NAME="ertaki-restore-proof-$$"
PORT=55432
PASS="restore_proof_pass_$$"

cleanup() {
  sudo docker rm -f "$NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Starting disposable Postgres ($NAME)…"
sudo docker run -d --name "$NAME" \
  -e POSTGRES_USER=ertaki \
  -e POSTGRES_PASSWORD="$PASS" \
  -e POSTGRES_DB=ertaki \
  -p "$PORT:5432" \
  postgres:16-alpine >/dev/null

for i in $(seq 1 40); do
  sudo docker exec "$NAME" pg_isready -U ertaki -d ertaki >/dev/null 2>&1 && break
  sleep 1
done

echo "Applying TypeORM migrations…"
cd "$ROOT/api"
npm run build >/dev/null
DATABASE_URL="postgres://ertaki:${PASS}@127.0.0.1:${PORT}/ertaki" DB_TYPE=postgres \
  node ./node_modules/typeorm/cli.js migration:run -d dist/data-source.js >/tmp/restore-mig.log

echo "Seeding marker row…"
sudo docker exec -i "$NAME" psql -U ertaki -d ertaki -v ON_ERROR_STOP=1 <<SQL
INSERT INTO users (id, "firstName", "lastName", phone, "passwordHash", role, status)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Proof',
  'User',
  '0599999999',
  'x',
  'student',
  'new'
);
SQL

DUMP="$(mktemp).sql.gz"
sudo docker exec "$NAME" pg_dump -U ertaki ertaki | gzip -c > "$DUMP"

echo "Wiping database…"
sudo docker exec "$NAME" psql -U ertaki -d ertaki -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

echo "Restoring dump…"
gunzip -c "$DUMP" | sudo docker exec -i "$NAME" psql -U ertaki -d ertaki >/tmp/restore-psql.log

COUNT="$(sudo docker exec "$NAME" psql -U ertaki -d ertaki -Atc "SELECT count(*) FROM users WHERE phone='0599999999';")"
MIG="$(sudo docker exec "$NAME" psql -U ertaki -d ertaki -Atc "SELECT count(*) FROM migrations;")"

rm -f "$DUMP"

{
  echo "# Restore proof"
  echo
  echo "- **When:** $STAMP"
  echo "- **Method:** disposable \`postgres:16-alpine\` + TypeORM \`InitialSchema\` migration + pg_dump/pg_restore round-trip"
  echo "- **Marker user recovered:** count=$COUNT (expect 1)"
  echo "- **Migrations table rows:** $MIG (expect ≥1)"
  echo "- **Result:** $([ "$COUNT" = "1" ] && echo PASS || echo FAIL)"
  echo
  echo "Command: \`./deploy/scripts/prove-restore.sh\`"
} > "$EVIDENCE"

echo "Wrote $EVIDENCE"
[ "$COUNT" = "1" ]
