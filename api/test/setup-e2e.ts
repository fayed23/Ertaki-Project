process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'ci-test-secret-not-for-production-32chars';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.SQLITE_PATH = process.env.SQLITE_PATH || ':memory:';
