import { DataSource } from 'typeorm';
import { entities } from './domain/domain.module';
import { InitialSchema1730000000000 } from './migrations/1730000000000-InitialSchema';

const isSqlite = (process.env.DB_TYPE || 'sqlite').toLowerCase() !== 'postgres';

/**
 * CLI data source for TypeORM migrations (Postgres prod path).
 * Local SQLite continues to use synchronize:true via AppModule — not this file.
 */
const dataSource = new DataSource(
  isSqlite
    ? {
        type: 'better-sqlite3',
        database: process.env.SQLITE_PATH || 'ertaki.dev.sqlite',
        entities,
        migrations: [InitialSchema1730000000000],
        synchronize: false,
      }
    : {
        type: 'postgres',
        url:
          process.env.DATABASE_URL ||
          'postgres://ertaki:ertaki@localhost:5432/ertaki',
        entities,
        migrations: [InitialSchema1730000000000],
        synchronize: false,
      },
);

export default dataSource;
