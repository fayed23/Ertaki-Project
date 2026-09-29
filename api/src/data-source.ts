import { DataSource } from 'typeorm';
import { entities } from './domain/domain.module';
import { InitialSchema1730000000000 } from './migrations/1730000000000-InitialSchema';
import { StudentRequests1740000000000 } from './migrations/1740000000000-StudentRequests';
import { MemorizationProgress1750000000000 } from './migrations/1750000000000-MemorizationProgress';

const isSqlite = (process.env.DB_TYPE || 'sqlite').toLowerCase() !== 'postgres';

/**
 * CLI data source for TypeORM migrations (Postgres prod path).
 * Local SQLite continues to use synchronize:true via AppModule — not this file.
 */
const migrations = [
  InitialSchema1730000000000,
  StudentRequests1740000000000,
  MemorizationProgress1750000000000,
];

const dataSource = new DataSource(
  isSqlite
    ? {
        type: 'better-sqlite3',
        database: process.env.SQLITE_PATH || 'ertaki.dev.sqlite',
        entities,
        migrations,
        synchronize: false,
      }
    : {
        type: 'postgres',
        url:
          process.env.DATABASE_URL ||
          'postgres://ertaki:ertaki@localhost:5432/ertaki',
        entities,
        migrations,
        synchronize: false,
      },
);

export default dataSource;
