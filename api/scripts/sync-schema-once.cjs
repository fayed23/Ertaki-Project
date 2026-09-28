const { DataSource } = require('typeorm');
const { entities } = require('../dist/domain/domain.module.js');

async function main() {
  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL || 'postgres://ertaki:ertaki_mig_tmp@127.0.0.1:5433/ertaki',
    entities,
    synchronize: true,
    logging: false,
  });
  await ds.initialize();
  const tables = await ds.query(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1`,
  );
  console.log('synced tables:', tables.map((r) => r.tablename));
  await ds.destroy();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
