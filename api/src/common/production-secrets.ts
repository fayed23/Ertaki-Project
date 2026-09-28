/**
 * Production secret / env contract.
 * Call before NestFactory.create when NODE_ENV=production.
 */
export function assertProductionSecrets() {
  const isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production';
  if (!isProd) return;

  const jwt = process.env.JWT_SECRET || '';
  const weakDefaults = new Set([
    '',
    'ertaki-dev-secret-change-me',
    'change-me',
    'secret',
    'change-me-to-a-long-random-string-at-least-32-chars',
  ]);
  if (weakDefaults.has(jwt) || jwt.length < 32 || /change-me/i.test(jwt)) {
    throw new Error(
      'Production requires JWT_SECRET (≥32 chars, not a documented default). Set it in .env.',
    );
  }

  if (process.env.TYPEORM_SYNC === 'true') {
    throw new Error(
      'Production forbids TYPEORM_SYNC=true. Use TypeORM migrations (RUN_MIGRATIONS=true).',
    );
  }

  const dbType = (process.env.DB_TYPE || 'sqlite').toLowerCase();
  if (dbType === 'postgres') {
    const url = process.env.DATABASE_URL || '';
    if (!url) {
      throw new Error('Production Postgres requires DATABASE_URL.');
    }
    const weakDb =
      /:ertaki@/i.test(url) ||
      /password=ertaki coi/i.test(url) ||
      /:password@/i.test(url) ||
      /:changeme@/i.test(url) ||
      /change-me/i.test(url);
    if (weakDb && !process.env.ALLOW_WEAK_DB_PASSWORD) {
      throw new Error(
        'Production DATABASE_URL must not use demo/placeholder passwords. Set POSTGRES_PASSWORD.',
      );
    }
  }

  const seed = (process.env.SEED_ON_EMPTY || 'false').toLowerCase();
  if (seed === 'true' && process.env.ALLOW_DEMO_SEED !== 'true') {
    throw new Error(
      'Production seeding requires ALLOW_DEMO_SEED=true (demo accounts use password123). Prefer SEED_ON_EMPTY=false.',
    );
  }
}

/** Parse CORS_ORIGINS (comma-separated). Empty → reflect request origin in non-prod only. */
export function resolveCorsOrigin():
  | boolean
  | string
  | string[]
  | ((
      origin: string | undefined,
      cb: (err: Error | null, allow?: boolean) => void,
    ) => void) {
  const raw = (process.env.CORS_ORIGINS || '').trim();
  const isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production';
  if (!raw) {
    // Production default: deny browser cross-origin unless CORS_ORIGINS is set.
    // Mobile apps are not subject to CORS; admin must list its origin(s).
    return isProd ? false : true;
  }
  if (raw === '*') return true;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
