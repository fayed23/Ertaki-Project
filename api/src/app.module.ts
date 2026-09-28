import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { DomainModule, entities } from './domain/domain.module';
import { SeedModule } from './seed/seed.module';
import { HealthModule } from './health/health.module';
import { StructuredLoggingInterceptor } from './common/structured-logging.interceptor';
import { InitialSchema1730000000000 } from './migrations/1730000000000-InitialSchema';

const useSqlite =
  (process.env.DB_TYPE || 'sqlite').toLowerCase() !== 'postgres';
const syncSqlite = useSqlite;
const syncPostgres = process.env.TYPEORM_SYNC === 'true';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 120,
      },
    ]),
    TypeOrmModule.forRoot(
      useSqlite
        ? {
            type: 'better-sqlite3',
            database: process.env.SQLITE_PATH || 'ertaki.dev.sqlite',
            entities,
            synchronize: syncSqlite,
            migrations: [InitialSchema1730000000000],
            migrationsRun: false,
          }
        : {
            type: 'postgres',
            url:
              process.env.DATABASE_URL ||
              'postgres://ertaki:ertaki@localhost:5432/ertaki',
            entities,
            synchronize: syncPostgres,
            migrations: [InitialSchema1730000000000],
            migrationsRun: false,
          },
    ),
    HealthModule,
    AuthModule,
    DomainModule,
    SeedModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: StructuredLoggingInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
