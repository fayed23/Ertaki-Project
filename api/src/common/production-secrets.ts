/**
 * Production secret contract.
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

  const dbType = (process.env.DB_TYPE || 'sqlite').toLowerCase();
  if (dbType === 'postgres') {
    const url = process.env.DATABASE_URL || '';
    if (!url) {
      throw new Error('Production Postgres requires DATABASE_URL.');
    }
    if (
      /:ertaki@|:password@|:changeme@/i.test(url) &&
      !process.env.ALLOW_WEAK_DB_PASSWORD
    ) {
      // Still allow if password is long enough elsewhere; block classic compose default.
      if (url.includes(':ertaki@') || url.includes('password=ertaki')) {
        throw new Error(
          'Production DATABASE_URL must not use the demo password "ertaki". Set POSTGRES_PASSWORD.',
        );
      }
    }
  }
}
