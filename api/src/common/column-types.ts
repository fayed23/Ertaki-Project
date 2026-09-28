/** Column type compatible with better-sqlite3 (local) and Postgres (prod). */
export const timestampColumnType =
  (process.env.DB_TYPE || 'sqlite').toLowerCase() === 'postgres'
    ? 'timestamp'
    : 'datetime';
