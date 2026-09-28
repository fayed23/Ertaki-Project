#!/bin/sh
set -e
if [ "${RUN_MIGRATIONS:-true}" = "true" ] && [ "${DB_TYPE:-postgres}" = "postgres" ]; then
  echo "Running TypeORM migrations…"
  node ./node_modules/typeorm/cli.js migration:run -d dist/data-source.js
fi
exec node dist/main.js
