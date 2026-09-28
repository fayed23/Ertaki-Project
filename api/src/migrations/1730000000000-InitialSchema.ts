import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Real Postgres initial schema (no synchronize).
 * Generated from TypeORM entity metadata via pg_dump --schema-only.
 */
export class InitialSchema1730000000000 implements MigrationInterface {
  name = 'InitialSchema1730000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tables = await queryRunner.getTables();
    if (tables.some((t) => t.name === 'users')) {
      return;
    }
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';

CREATE TABLE public.absence_excuse_requests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "studentId" uuid NOT NULL,
    "groupId" uuid NOT NULL,
    "sessionDate" date NOT NULL,
    reason text NOT NULL,
    status character varying DEFAULT 'pending'::character varying NOT NULL,
    "reviewedById" character varying,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.attendance (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "studentId" uuid NOT NULL,
    "groupId" uuid NOT NULL,
    "sessionDate" date NOT NULL,
    status character varying NOT NULL,
    "arrivedLate" boolean DEFAULT false NOT NULL,
    "leftEarly" boolean DEFAULT false NOT NULL,
    "recordedById" character varying NOT NULL,
    note text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.audit_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "actorId" character varying NOT NULL,
    action character varying NOT NULL,
    "entityType" character varying NOT NULL,
    "entityId" character varying,
    "beforeJson" text,
    "afterJson" text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.daily_reports (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "studentId" uuid NOT NULL,
    "reportDate" date NOT NULL,
    "memorizedQuota" boolean DEFAULT false NOT NULL,
    "memorizationFrom" character varying,
    "memorizationTo" character varying,
    "memorizationSurahNumber" integer,
    "memorizationSurahName" character varying,
    "memorizationAyahFrom" integer,
    "memorizationAyahTo" integer,
    "reviewPortion" character varying,
    "reviewFrom" character varying,
    "reviewTo" character varying,
    "completedFiftyRepetitions" boolean DEFAULT false NOT NULL,
    "repeatedInOneSitting" boolean DEFAULT false NOT NULL,
    "readTafsir" boolean DEFAULT false NOT NULL,
    "submittedAt" timestamp without time zone NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.device_tokens (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "userId" character varying NOT NULL,
    token text NOT NULL,
    platform character varying DEFAULT 'fcm'::character varying NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.group_memberships (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "userId" uuid NOT NULL,
    "groupId" uuid NOT NULL,
    "joinedAt" timestamp without time zone NOT NULL,
    "leftAt" timestamp without time zone,
    "leaveReason" character varying,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.groups (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    "teacherId" uuid NOT NULL,
    gender character varying NOT NULL,
    "seatCount" integer NOT NULL,
    "currentStudentCount" integer DEFAULT 0 NOT NULL,
    "weeklySessionDay" character varying NOT NULL,
    "weeklySessionTime" character varying NOT NULL,
    "sessionStartTime" character varying,
    "sessionEndTime" character varying,
    status character varying DEFAULT 'open'::character varying NOT NULL,
    "whatsappUrl" character varying,
    description text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.infraction_policies (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "infractionType" character varying NOT NULL,
    "thresholdCount" integer NOT NULL,
    action character varying NOT NULL,
    "actionLabel" text,
    enabled boolean DEFAULT true NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.infractions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "studentId" uuid NOT NULL,
    type character varying NOT NULL,
    source character varying NOT NULL,
    "occurredOn" date NOT NULL,
    details text,
    resolved boolean DEFAULT false NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.join_requests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "studentId" uuid NOT NULL,
    "groupId" uuid NOT NULL,
    status character varying DEFAULT 'pending'::character varying NOT NULL,
    "reviewedById" character varying,
    "reviewNote" text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.notification_stubs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "recipientId" character varying NOT NULL,
    type character varying NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    payload text,
    delivered boolean DEFAULT false NOT NULL,
    "readAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.program_content (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    key character varying NOT NULL,
    title character varying NOT NULL,
    body text NOT NULL,
    "videoUrl" character varying,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.report_deadline_configs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    timezone character varying DEFAULT 'Africa/Algiers'::character varying NOT NULL,
    "closeTimeLocal" character varying DEFAULT '23:59'::character varying NOT NULL,
    "reminderMinutesBefore" integer DEFAULT 60 NOT NULL,
    notes text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.student_notes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "studentId" uuid NOT NULL,
    "authorId" uuid NOT NULL,
    body text NOT NULL,
    visibility character varying DEFAULT 'internal'::character varying NOT NULL,
    "noteDate" date NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.student_quotas (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "studentId" uuid NOT NULL,
    "dailyQuotaDescription" text NOT NULL,
    "requiredRepetitions" integer DEFAULT 50 NOT NULL,
    "setById" character varying NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "firstName" character varying NOT NULL,
    "lastName" character varying NOT NULL,
    phone character varying NOT NULL,
    email character varying,
    "passwordHash" character varying NOT NULL,
    role character varying NOT NULL,
    status character varying DEFAULT 'new'::character varying NOT NULL,
    "accountReviewNote" text,
    gender character varying,
    "birthDate" date,
    city character varying,
    "currentMemorization" character varying,
    "memorizationLevel" character varying,
    "previousErtakiParticipant" boolean DEFAULT false NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.weekly_reports (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "studentId" uuid NOT NULL,
    "groupId" uuid,
    "weekStartDate" date NOT NULL,
    "weekEndDate" date NOT NULL,
    "dailyReportsSubmitted" integer DEFAULT 0 NOT NULL,
    "quotaDaysMet" integer DEFAULT 0 NOT NULL,
    "fiftyRepsDaysMet" integer DEFAULT 0 NOT NULL,
    "presentSessions" integer DEFAULT 0 NOT NULL,
    "excusedAbsences" integer DEFAULT 0 NOT NULL,
    "unexcusedAbsences" integer DEFAULT 0 NOT NULL,
    "summaryJson" text,
    "studentConfirmedAt" timestamp without time zone,
    "generatedAt" timestamp without time zone NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.weekly_reports
    ADD CONSTRAINT "PK_1a8cd4b8d43d7a359597b75f792" PRIMARY KEY (id);

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY (id);

ALTER TABLE ONLY public.student_notes
    ADD CONSTRAINT "PK_257514e973a4a2a4a41e6e1e6f7" PRIMARY KEY (id);

ALTER TABLE ONLY public.join_requests
    ADD CONSTRAINT "PK_3584a09620923a5aaf7de782f0d" PRIMARY KEY (id);

ALTER TABLE ONLY public.group_memberships
    ADD CONSTRAINT "PK_4a04ebe9f25ad41f45b2c0ca4b5" PRIMARY KEY (id);

ALTER TABLE ONLY public.student_quotas
    ADD CONSTRAINT "PK_51d876748057ec9b026f6543a53" PRIMARY KEY (id);

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT "PK_659d1483316afb28afd3a90646e" PRIMARY KEY (id);

ALTER TABLE ONLY public.notification_stubs
    ADD CONSTRAINT "PK_80fb95ea865179eb86efe68c29b" PRIMARY KEY (id);

ALTER TABLE ONLY public.device_tokens
    ADD CONSTRAINT "PK_84700be257607cfb1f9dc2e52c3" PRIMARY KEY (id);

ALTER TABLE ONLY public.report_deadline_configs
    ADD CONSTRAINT "PK_8b6bc6efb039f34f1c9dc8269a1" PRIMARY KEY (id);

ALTER TABLE ONLY public.program_content
    ADD CONSTRAINT "PK_8b7b7b4f47bc7bbf85eee754b12" PRIMARY KEY (id);

ALTER TABLE ONLY public.daily_reports
    ADD CONSTRAINT "PK_9c061cec58b95e2cc8ed285db09" PRIMARY KEY (id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY (id);

ALTER TABLE ONLY public.infractions
    ADD CONSTRAINT "PK_bb31dc644908a33ec973147e589" PRIMARY KEY (id);

ALTER TABLE ONLY public.absence_excuse_requests
    ADD CONSTRAINT "PK_dcd0c0e7ca706e6917b57aece15" PRIMARY KEY (id);

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT "PK_ee0ffe42c1f1a01e72b725c0cb2" PRIMARY KEY (id);

ALTER TABLE ONLY public.infraction_policies
    ADD CONSTRAINT "PK_fb34e841ce8b3adaed6fed37802" PRIMARY KEY (id);

ALTER TABLE ONLY public.student_quotas
    ADD CONSTRAINT "UQ_15c0aeac9bcd07021a85a17435e" UNIQUE ("studentId");

ALTER TABLE ONLY public.daily_reports
    ADD CONSTRAINT "UQ_7388dbe804776c047fd3a5b4c7a" UNIQUE ("studentId", "reportDate");

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "UQ_a000cca60bcf04454e727699490" UNIQUE (phone);

ALTER TABLE ONLY public.weekly_reports
    ADD CONSTRAINT "UQ_acd9519c9109afe7e1ab551ac37" UNIQUE ("studentId", "weekStartDate");

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT "UQ_d528688f63073dbad699a320bac" UNIQUE ("studentId", "groupId", "sessionDate");

ALTER TABLE ONLY public.program_content
    ADD CONSTRAINT "UQ_fa3810c7ee5feaa2e774af5b034" UNIQUE (key);

CREATE INDEX "IDX_511957e3e8443429dc3fb00120" ON public.device_tokens USING btree ("userId");

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT "FK_120e1c6edcec4f8221f467c8039" FOREIGN KEY ("studentId") REFERENCES public.users(id);

ALTER TABLE ONLY public.student_notes
    ADD CONSTRAINT "FK_1355c40e98f4ccf8fbbc23063a1" FOREIGN KEY ("studentId") REFERENCES public.users(id);

ALTER TABLE ONLY public.student_quotas
    ADD CONSTRAINT "FK_15c0aeac9bcd07021a85a17435e" FOREIGN KEY ("studentId") REFERENCES public.users(id);

ALTER TABLE ONLY public.absence_excuse_requests
    ADD CONSTRAINT "FK_19a22b8a14aba81e23c0d60984b" FOREIGN KEY ("studentId") REFERENCES public.users(id);

ALTER TABLE ONLY public.daily_reports
    ADD CONSTRAINT "FK_19a420bf36a983ac74b97126ba1" FOREIGN KEY ("studentId") REFERENCES public.users(id);

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT "FK_2760be2ce05ac070bd6ecbdbc9a" FOREIGN KEY ("groupId") REFERENCES public.groups(id);

ALTER TABLE ONLY public.student_notes
    ADD CONSTRAINT "FK_8efbe63f4e91390135ae05cde7c" FOREIGN KEY ("authorId") REFERENCES public.users(id);

ALTER TABLE ONLY public.infractions
    ADD CONSTRAINT "FK_9109316778c003d810cd260b680" FOREIGN KEY ("studentId") REFERENCES public.users(id);

ALTER TABLE ONLY public.group_memberships
    ADD CONSTRAINT "FK_a434c0d46f4b97696924ecdd176" FOREIGN KEY ("groupId") REFERENCES public.groups(id);

ALTER TABLE ONLY public.group_memberships
    ADD CONSTRAINT "FK_ae52b7a8e0e084d7945522ef762" FOREIGN KEY ("userId") REFERENCES public.users(id);

ALTER TABLE ONLY public.weekly_reports
    ADD CONSTRAINT "FK_b5399e95f9fb0fe02afab835834" FOREIGN KEY ("studentId") REFERENCES public.users(id);

ALTER TABLE ONLY public.absence_excuse_requests
    ADD CONSTRAINT "FK_c68b74cf2ba2a6f4d4b5a40acfd" FOREIGN KEY ("groupId") REFERENCES public.groups(id);

ALTER TABLE ONLY public.weekly_reports
    ADD CONSTRAINT "FK_d37dd37e3227d7239ec60045dbe" FOREIGN KEY ("groupId") REFERENCES public.groups(id);

ALTER TABLE ONLY public.join_requests
    ADD CONSTRAINT "FK_e02608b7fcd27b0ceb7937ff660" FOREIGN KEY ("groupId") REFERENCES public.groups(id);

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT "FK_e63173ac43b478c2fc0cc20ac39" FOREIGN KEY ("teacherId") REFERENCES public.users(id);

ALTER TABLE ONLY public.join_requests
    ADD CONSTRAINT "FK_f03cc773b18b9d7b3592bc5549a" FOREIGN KEY ("studentId") REFERENCES public.users(id);
`);
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
      await queryRunner.query('DROP TABLE IF EXISTS "' + table + '" CASCADE');
    }
    await queryRunner.query('DROP EXTENSION IF EXISTS "uuid-ossp"');
  }
}
