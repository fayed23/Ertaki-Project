import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { DomainModule, entities } from './domain/domain.module';
import { SeedModule } from './seed/seed.module';

const useSqlite =
  (process.env.DB_TYPE || 'sqlite').toLowerCase() !== 'postgres';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(
      useSqlite
        ? {
            type: 'better-sqlite3',
            database: process.env.SQLITE_PATH || 'ertaki.dev.sqlite',
            entities,
            synchronize: true,
          }
        : {
            type: 'postgres',
            url:
              process.env.DATABASE_URL ||
              'postgres://ertaki:ertaki@localhost:5432/ertaki',
            entities,
            synchronize: process.env.TYPEORM_SYNC === 'true',
          },
    ),
    AuthModule,
    DomainModule,
    SeedModule,
  ],
})
export class AppModule {}
