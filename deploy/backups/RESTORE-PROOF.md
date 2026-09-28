# Restore proof

- **When:** 2026-09-28T12:41:59Z
- **Method:** disposable `postgres:16-alpine` + TypeORM `InitialSchema` migration + pg_dump/pg_restore round-trip
- **Marker user recovered:** count=1 (expect 1)
- **Migrations table rows:** 1 (expect ≥1)
- **Result:** PASS

Command: `./deploy/scripts/prove-restore.sh`
