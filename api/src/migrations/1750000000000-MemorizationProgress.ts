import { MigrationInterface, QueryRunner } from 'typeorm';

export class MemorizationProgress1750000000000 implements MigrationInterface {
  name = 'MemorizationProgress1750000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
CREATE TABLE IF NOT EXISTS public.memorization_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "studentId" uuid NOT NULL,
    "groupId" uuid,
    "startSurahNumber" integer NOT NULL,
    "startSurahName" character varying NOT NULL,
    "startAyah" integer NOT NULL,
    pace character varying DEFAULT 'half_page'::character varying NOT NULL,
    "setById" uuid NOT NULL,
    "studentMayEdit" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT "PK_memorization_plans" PRIMARY KEY (id),
    CONSTRAINT "UQ_memorization_plans_student" UNIQUE ("studentId")
);
`);
    await queryRunner.query(`
CREATE TABLE IF NOT EXISTS public.memorization_progress (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "studentId" uuid NOT NULL,
    "planId" uuid NOT NULL,
    "currentSurahNumber" integer NOT NULL,
    "currentSurahName" character varying NOT NULL,
    "currentAyah" integer NOT NULL,
    "cycleNumber" integer DEFAULT 1 NOT NULL,
    "hizbsInCycle" integer DEFAULT 0 NOT NULL,
    "startedAt" timestamp without time zone NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT "PK_memorization_progress" PRIMARY KEY (id),
    CONSTRAINT "UQ_memorization_progress_student" UNIQUE ("studentId")
);
`);
    await queryRunner.query(`
CREATE TABLE IF NOT EXISTS public.memorization_progress_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "studentId" uuid NOT NULL,
    "resetId" uuid,
    "snapshotJson" text NOT NULL,
    "archivedById" uuid NOT NULL,
    reason text NOT NULL,
    "archivedAt" timestamp without time zone NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT "PK_memorization_progress_history" PRIMARY KEY (id)
);
`);
    await queryRunner.query(`
CREATE TABLE IF NOT EXISTS public.memorization_hizb_completions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "studentId" uuid NOT NULL,
    "hizbNumber" integer NOT NULL,
    "cycleNumber" integer NOT NULL,
    "recordedById" uuid NOT NULL,
    "completedAt" timestamp without time zone NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT "PK_memorization_hizb_completions" PRIMARY KEY (id),
    CONSTRAINT "UQ_memorization_hizb_student_hizb_cycle" UNIQUE ("studentId", "hizbNumber", "cycleNumber")
);
`);
    await queryRunner.query(`
CREATE TABLE IF NOT EXISTS public.memorization_achievements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "studentId" uuid NOT NULL,
    type character varying NOT NULL,
    title character varying NOT NULL,
    "hizbNumber" integer,
    "cycleNumber" integer,
    "certificateId" uuid,
    "earnedAt" timestamp without time zone NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT "PK_memorization_achievements" PRIMARY KEY (id)
);
`);
    await queryRunner.query(`
CREATE TABLE IF NOT EXISTS public.memorization_assessments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "studentId" uuid NOT NULL,
    "cycleNumber" integer NOT NULL,
    status character varying DEFAULT 'pending'::character varying NOT NULL,
    "assessedById" uuid,
    notes text,
    "scheduledAt" timestamp without time zone,
    "completedAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT "PK_memorization_assessments" PRIMARY KEY (id)
);
`);
    await queryRunner.query(`
CREATE TABLE IF NOT EXISTS public.memorization_certificates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "studentId" uuid NOT NULL,
    "cycleNumber" integer NOT NULL,
    title character varying NOT NULL,
    "serialCode" character varying NOT NULL,
    "issuedById" uuid NOT NULL,
    "assessmentId" uuid,
    "issuedAt" timestamp without time zone NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT "PK_memorization_certificates" PRIMARY KEY (id),
    CONSTRAINT "UQ_memorization_certificates_student_cycle" UNIQUE ("studentId", "cycleNumber")
);
`);
    await queryRunner.query(`
CREATE TABLE IF NOT EXISTS public.memorization_plan_changes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "studentId" uuid NOT NULL,
    "planId" uuid NOT NULL,
    "changeKind" character varying NOT NULL,
    "previousJson" text,
    "newJson" text NOT NULL,
    "changedById" uuid NOT NULL,
    reason text NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT "PK_memorization_plan_changes" PRIMARY KEY (id)
);
`);
    await queryRunner.query(`
CREATE TABLE IF NOT EXISTS public.memorization_resets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "studentId" uuid NOT NULL,
    "previousProgressJson" text NOT NULL,
    "historyId" uuid,
    "newProgressId" uuid,
    "resetById" uuid NOT NULL,
    reason text NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT "PK_memorization_resets" PRIMARY KEY (id)
);
`);
    await queryRunner.query(`
CREATE INDEX IF NOT EXISTS "IDX_memorization_hizb_student_cycle"
  ON public.memorization_hizb_completions ("studentId", "cycleNumber");
`);
    await queryRunner.query(`
CREATE INDEX IF NOT EXISTS "IDX_memorization_achievements_student"
  ON public.memorization_achievements ("studentId");
`);
    await queryRunner.query(`
CREATE INDEX IF NOT EXISTS "IDX_memorization_assessments_student_cycle"
  ON public.memorization_assessments ("studentId", "cycleNumber");
`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS public.memorization_resets`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS public.memorization_plan_changes`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS public.memorization_certificates`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS public.memorization_assessments`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS public.memorization_achievements`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS public.memorization_hizb_completions`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS public.memorization_progress_history`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS public.memorization_progress`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS public.memorization_plans`);
  }
}
