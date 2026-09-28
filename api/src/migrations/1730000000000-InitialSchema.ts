import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bootstrap migration: materialize current entity metadata once.
 * Subsequent schema changes must add real up/down migrations
 * (`npm run migration:generate -- src/migrations/Name`).
 */
export class InitialSchema1730000000000 implements MigrationInterface {
  name = 'InitialSchema1730000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tables = await queryRunner.getTables();
    const names = new Set(tables.map((t) => t.name));
    if (names.has('users') && names.has('daily_reports')) {
      return;
    }
    await queryRunner.connection.synchronize();
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      'audit_logs',
      'device_tokens',
      'notification_stubs',
      'report_deadline_configs',
      'program_content',
      'student_quotas',
      'infraction_policies',
      'infractions',
      'student_notes',
      'absence_excuse_requests',
      'attendance',
      'weekly_reports',
      'daily_reports',
      'join_requests',
      'group_memberships',
      'groups',
      'users',
    ];
    for (const table of tables) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
    }
  }
}
