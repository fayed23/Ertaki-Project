import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Student request system: general requests + daily-report/attendance excuse links.
 * Copies legacy absence_excuse_requests into student_requests as weekly_session_absence.
 */
export class StudentRequests1740000000000 implements MigrationInterface {
  name = 'StudentRequests1740000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
CREATE TABLE IF NOT EXISTS public.student_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "studentId" uuid NOT NULL,
    "groupId" uuid NOT NULL,
    "teacherId" uuid,
    type character varying NOT NULL,
    "relevantDate" date NOT NULL,
    reason text NOT NULL,
    "attachmentPath" character varying,
    "attachmentOriginalName" character varying,
    "attachmentMime" character varying,
    "attachmentSize" integer,
    status character varying DEFAULT 'pending'::character varying NOT NULL,
    "reviewerId" uuid,
    "reviewerNote" text,
    "reviewedAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT "PK_student_requests" PRIMARY KEY (id)
);
`);
    await queryRunner.query(`
CREATE INDEX IF NOT EXISTS "IDX_student_requests_student_type_date"
  ON public.student_requests ("studentId", type, "relevantDate");
`);
    await queryRunner.query(`
CREATE INDEX IF NOT EXISTS "IDX_student_requests_status_created"
  ON public.student_requests (status, "createdAt");
`);

    const hasLegacy = await queryRunner.query(`
SELECT 1 FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'absence_excuse_requests' LIMIT 1;
`);
    if (hasLegacy.length) {
      await queryRunner.query(`
INSERT INTO public.student_requests (
  id, "studentId", "groupId", "teacherId", type, "relevantDate", reason,
  status, "reviewerId", "reviewedAt", "createdAt", "updatedAt"
)
SELECT
  e.id,
  e."studentId",
  e."groupId",
  g."teacherId",
  'weekly_session_absence',
  e."sessionDate",
  e.reason,
  e.status,
  e."reviewedById",
  CASE WHEN e.status <> 'pending' THEN e."updatedAt" ELSE NULL END,
  e."createdAt",
  e."updatedAt"
FROM public.absence_excuse_requests e
LEFT JOIN public.groups g ON g.id = e."groupId"
ON CONFLICT (id) DO NOTHING;
`);
    }

    await queryRunner.query(`
ALTER TABLE public.daily_reports
  ADD COLUMN IF NOT EXISTS status character varying DEFAULT 'submitted'::character varying NOT NULL;
`);
    await queryRunner.query(`
ALTER TABLE public.daily_reports
  ADD COLUMN IF NOT EXISTS "excuseRequestId" uuid;
`);
    await queryRunner.query(`
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS "excuseRequestId" uuid;
`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE public.attendance DROP COLUMN IF EXISTS "excuseRequestId"`,
    );
    await queryRunner.query(
      `ALTER TABLE public.daily_reports DROP COLUMN IF EXISTS "excuseRequestId"`,
    );
    await queryRunner.query(
      `ALTER TABLE public.daily_reports DROP COLUMN IF EXISTS status`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS public.student_requests`);
  }
}
