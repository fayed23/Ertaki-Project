import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { IsNull, Repository } from 'typeorm';
import {
  GroupGender,
  GroupStatus,
  InfractionType,
  UserRole,
  UserStatus,
  InfractionAction,
  DailyReportStatus,
} from '../common/enums';
import { User } from '../entities/user.entity';
import { Group } from '../entities/group.entity';
import { GroupMembership } from '../entities/group-membership.entity';
import { JoinRequest } from '../entities/join-request.entity';
import { DailyReport } from '../entities/daily-report.entity';
import { WeeklyReport } from '../entities/weekly-report.entity';
import { Attendance } from '../entities/attendance.entity';
import { AbsenceExcuseRequest } from '../entities/absence-excuse-request.entity';
import { StudentRequest } from '../entities/student-request.entity';
import { StudentNote } from '../entities/student-note.entity';
import { Infraction } from '../entities/infraction.entity';
import { InfractionPolicy } from '../entities/infraction-policy.entity';
import { StudentQuota } from '../entities/student-quota.entity';
import { NotificationStub } from '../entities/notification-stub.entity';
import { ProgramContent } from '../entities/program-content.entity';
import { ReportDeadlineConfig } from '../entities/report-deadline-config.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { PushService } from './push.service';

/** Shared repositories and domain helpers. */
@Injectable()
export class DomainContext {
  constructor(
    @InjectRepository(User) readonly users: Repository<User>,
    @InjectRepository(Group) readonly groups: Repository<Group>,
    @InjectRepository(GroupMembership)
    readonly memberships: Repository<GroupMembership>,
    @InjectRepository(JoinRequest)
    readonly joinRequests: Repository<JoinRequest>,
    @InjectRepository(DailyReport)
    readonly dailyReports: Repository<DailyReport>,
    @InjectRepository(WeeklyReport)
    readonly weeklyReports: Repository<WeeklyReport>,
    @InjectRepository(Attendance)
    readonly attendance: Repository<Attendance>,
    @InjectRepository(AbsenceExcuseRequest)
    readonly excuses: Repository<AbsenceExcuseRequest>,
    @InjectRepository(StudentRequest)
    readonly studentRequests: Repository<StudentRequest>,
    @InjectRepository(StudentNote)
    readonly notes: Repository<StudentNote>,
    @InjectRepository(Infraction)
    readonly infractions: Repository<Infraction>,
    @InjectRepository(InfractionPolicy)
    readonly policies: Repository<InfractionPolicy>,
    @InjectRepository(StudentQuota)
    readonly quotas: Repository<StudentQuota>,
    @InjectRepository(NotificationStub)
    readonly notifications: Repository<NotificationStub>,
    @InjectRepository(ProgramContent)
    readonly content: Repository<ProgramContent>,
    @InjectRepository(ReportDeadlineConfig)
    readonly deadlines: Repository<ReportDeadlineConfig>,
    @InjectRepository(AuditLog)
    readonly audit: Repository<AuditLog>,
    readonly push: PushService,
  ) {}

  qalunSurahCounts: Map<number, { nameAr: string; ayahCount: number }> | null =
    null;

  async auditLog(
    actorId: string,
    action: string,
    entityType: string,
    entityId: string | null,
    beforeJson: Record<string, unknown> | null,
    afterJson: Record<string, unknown> | null,
  ) {
    await this.audit.save(
      this.audit.create({
        actorId,
        action,
        entityType,
        entityId,
        beforeJson,
        afterJson,
      }),
    );
  }

  async notify(
    recipientId: string,
    type: string,
    title: string,
    body: string,
    payload?: Record<string, unknown>,
  ) {
    await this.push.notify(recipientId, type, title, body, payload);
  }

  /** Teacher of student's active group only (not supervisors). */
  async notifyTeacherAboutStudent(
    studentId: string,
    type: string,
    title: string,
    body: string,
    payload?: Record<string, unknown>,
  ) {
    const membership = await this.memberships.findOne({
      where: { userId: studentId, leftAt: IsNull() },
    });
    if (!membership) return;
    const group = await this.groups.findOne({
      where: { id: membership.groupId },
    });
    if (!group?.teacherId) return;
    await this.notify(group.teacherId, type, title, body, {
      studentId,
      ...(payload ?? {}),
    });
  }

  /** Teacher of student's active group + all supervisors/admins (non-report events). */
  async notifyStaffAboutStudent(
    studentId: string,
    type: string,
    title: string,
    body: string,
    payload?: Record<string, unknown>,
    skipUserId?: string,
  ) {
    const recipients = new Set<string>();
    const membership = await this.memberships.findOne({
      where: { userId: studentId, leftAt: IsNull() },
    });
    if (membership) {
      const group = await this.groups.findOne({
        where: { id: membership.groupId },
      });
      if (group?.teacherId) recipients.add(group.teacherId);
    }
    const supervisors = await this.users.find({
      where: [{ role: UserRole.SUPERVISOR }, { role: UserRole.ADMIN }],
    });
    for (const s of supervisors) recipients.add(s.id);
    if (skipUserId) recipients.delete(skipUserId);
    for (const id of recipients) {
      await this.notify(id, type, title, body, {
        studentId,
        ...(payload ?? {}),
      });
    }
  }

  normalizeUserGender(raw?: string | null): GroupGender | null {
    if (!raw) return null;
    const v = raw.trim().toLowerCase();
    if (['men', 'male', 'm', 'رجال', 'رجل'].includes(v)) return GroupGender.MEN;
    if (['women', 'female', 'f', 'نساء', 'امرأة', 'اناث', 'إناث'].includes(v)) {
      return GroupGender.WOMEN;
    }
    return null;
  }

  assertCanViewGroup(actor: User, teacherId: string) {
    if (this.isSupervisor(actor)) return;
    if (actor.role === UserRole.TEACHER && actor.id === teacherId) return;
    throw new ForbiddenException();
  }

  formatWeekly(w: WeeklyReport, mode: 'brief' | 'detailed' = 'brief') {
    const student = w.student;
    const summary = (w.summaryJson ?? {}) as Record<string, unknown>;
    const attended =
      typeof summary.attendedMajlis === 'boolean'
        ? summary.attendedMajlis
        : w.presentSessions > 0;
    const pdf = {
      attendedMajlis: attended,
      attendedMajlisLabel: attended ? 'نعم' : 'لا',
      missedDailyReports:
        (summary.missedDailyReports as number | undefined) ??
        Math.max(0, 7 - w.dailyReportsSubmitted),
      missedQuota:
        (summary.missedQuota as number | undefined) ??
        Math.max(0, 7 - w.quotaDaysMet),
      missedFiftyReps:
        (summary.missedFiftyReps as number | undefined) ??
        Math.max(0, 7 - w.fiftyRepsDaysMet),
      missedSingleSitting:
        (summary.missedSingleSitting as number | undefined) ?? 0,
      missedReview: (summary.missedReview as number | undefined) ?? 0,
    };
    const studentName = student
      ? `${student.firstName} ${student.lastName}`
      : null;
    const base = {
      id: w.id,
      studentId: w.studentId,
      studentName,
      groupId: w.groupId,
      groupName: w.group?.name ?? null,
      weekStartDate: w.weekStartDate,
      weekEndDate: w.weekEndDate,
      dailyReportsSubmitted: w.dailyReportsSubmitted,
      quotaDaysMet: w.quotaDaysMet,
      fiftyRepsDaysMet: w.fiftyRepsDaysMet,
      presentSessions: w.presentSessions,
      excusedAbsences: w.excusedAbsences,
      unexcusedAbsences: w.unexcusedAbsences,
      ...pdf,
      studentConfirmedAt: w.studentConfirmedAt,
      generatedAt: w.generatedAt,
      mode,
    };
    if (mode === 'brief') return base;
    return { ...base, summaryJson: w.summaryJson };
  }

  loadQalunSurahCounts() {
    if (this.qalunSurahCounts) return this.qalunSurahCounts;
    const candidates = [
      join(process.cwd(), 'data/quran/qalun_surahs.json'),
      join(__dirname, '../../data/quran/qalun_surahs.json'),
    ];
    let raw: string | null = null;
    for (const p of candidates) {
      if (existsSync(p)) {
        raw = readFileSync(p, 'utf8');
        break;
      }
    }
    if (!raw) {
      throw new BadRequestException('بيانات سور قالون غير متوفرة على الخادم');
    }
    const data = JSON.parse(raw) as {
      surahs: Array<{ number: number; nameAr: string; ayahCount: number }>;
    };
    this.qalunSurahCounts = new Map(
      data.surahs.map((s) => [
        s.number,
        { nameAr: s.nameAr, ayahCount: s.ayahCount },
      ]),
    );
    return this.qalunSurahCounts;
  }

  validateQalunMemorizationRange(input: {
    memorizedQuota: boolean;
    memorizationSurahNumber?: number;
    memorizationSurahName?: string;
    memorizationAyahFrom?: number;
    memorizationAyahTo?: number;
  }) {
    if (!input.memorizedQuota) return null;
    const n = Number(input.memorizationSurahNumber);
    const from = Number(input.memorizationAyahFrom);
    const to = Number(input.memorizationAyahTo);
    if (!Number.isFinite(n) || !Number.isFinite(from) || !Number.isFinite(to)) {
      throw new BadRequestException(
        'حدد السورة والآيات حسب رواية قالون عن نافع',
      );
    }
    const map = this.loadQalunSurahCounts();
    const surah = map.get(n);
    if (!surah) {
      throw new BadRequestException('رقم السورة غير صالح في رواية قالون');
    }
    if (from < 1 || to < from || to > surah.ayahCount) {
      throw new BadRequestException(
        `نطاق الآيات غير صالح لهذه السورة في قالون (1–${surah.ayahCount})`,
      );
    }
    return {
      surahNumber: n,
      surahName: surah.nameAr,
      ayahFrom: from,
      ayahTo: to,
    };
  }

  /**
   * Visibility (locked): teacher of the student's group only for others' reports.
   * Supervisors never list/open daily report content.
   * Students see only their own. Peers never see classmate submit status.
   */
  async assertTeacherOwnsStudent(actor: User, studentId: string) {
    if (actor.role !== UserRole.TEACHER) throw new ForbiddenException();
    const myGroups = await this.groups.find({ where: { teacherId: actor.id } });
    const ids = myGroups.map((g) => g.id);
    if (!ids.length) throw new ForbiddenException();
    const membership = await this.memberships.findOne({
      where: ids.map((groupId) => ({
        groupId,
        userId: studentId,
        leftAt: IsNull(),
      })),
    });
    if (!membership) throw new ForbiddenException('هذا الطالب ليس في مجموعاتك');
  }

  async enrichDailyReport(report: DailyReport) {
    const student =
      report.student ||
      (await this.users.findOne({ where: { id: report.studentId } }));
    const membership = await this.memberships.findOne({
      where: { userId: report.studentId, leftAt: IsNull() },
    });
    const group = membership
      ? await this.groups.findOne({ where: { id: membership.groupId } })
      : null;
    const safeStudent = student
      ? {
          id: student.id,
          firstName: student.firstName,
          lastName: student.lastName,
          phone: student.phone,
          role: student.role,
          status: student.status,
        }
      : null;
    return {
      id: report.id,
      studentId: report.studentId,
      reportDate: report.reportDate,
      status: report.status,
      excuseRequestId: report.excuseRequestId,
      memorizedQuota: report.memorizedQuota,
      memorizationFrom: report.memorizationFrom,
      memorizationTo: report.memorizationTo,
      memorizationSurahNumber: report.memorizationSurahNumber,
      memorizationSurahName: report.memorizationSurahName,
      memorizationAyahFrom: report.memorizationAyahFrom,
      memorizationAyahTo: report.memorizationAyahTo,
      reviewPortion: report.reviewPortion,
      reviewFrom: report.reviewFrom,
      reviewTo: report.reviewTo,
      completedFiftyRepetitions: report.completedFiftyRepetitions,
      repeatedInOneSitting: report.repeatedInOneSitting,
      readTafsir: report.readTafsir,
      submittedAt: report.submittedAt,
      createdAt: report.createdAt,
      student: safeStudent,
      studentName: safeStudent
        ? `${safeStudent.firstName} ${safeStudent.lastName}`
        : null,
      group: group ? { id: group.id, name: group.name } : null,
      groupName: group?.name ?? null,
    };
  }

  async evaluateContentInfractions(studentId: string, report: DailyReport) {
    if (report.status === DailyReportStatus.EXCUSED) return;
    const quota = await this.quotas.findOne({ where: { studentId } });
    if (!report.memorizedQuota) {
      await this.recordInfraction(
        studentId,
        InfractionType.MISSED_QUOTA,
        'daily_report',
        report.reportDate,
        'لم يحفظ القسط اليومي',
      );
    }
    const requiredReps = quota?.requiredRepetitions ?? 50;
    if (!report.completedFiftyRepetitions && requiredReps > 0) {
      await this.recordInfraction(
        studentId,
        InfractionType.MISSED_50_REPS,
        'daily_report',
        report.reportDate,
        `لم يكمل ${requiredReps} تكراراً`,
      );
    }
    if (!report.repeatedInOneSitting) {
      await this.recordInfraction(
        studentId,
        InfractionType.MISSED_SINGLE_SITTING,
        'daily_report',
        report.reportDate,
        'لم يكرر في مجلس واحد',
      );
    }
    if (!report.reviewPortion) {
      await this.recordInfraction(
        studentId,
        InfractionType.MISSED_REVIEW,
        'daily_report',
        report.reportDate,
        'لم يُسجَّل ورد المراجعة',
      );
    }
  }

  async recordInfraction(
    studentId: string,
    type: InfractionType,
    source: string,
    occurredOn: string,
    details: string,
  ) {
    const existing = await this.infractions.findOne({
      where: { studentId, type, occurredOn, source },
    });
    if (existing) return existing;
    const inf = await this.infractions.save(
      this.infractions.create({
        studentId,
        type,
        source,
        occurredOn,
        details,
      }),
    );
    await this.applyConfigurableConsequences(studentId, type);
    return inf;
  }

  /** Consequences come only from InfractionPolicy rows — never hardcoded. */
  async applyConfigurableConsequences(studentId: string, type: InfractionType) {
    const count = await this.infractions.count({
      where: { studentId, type, resolved: false },
    });
    const policies = await this.policies.find({
      where: { infractionType: type, enabled: true },
      order: { thresholdCount: 'DESC' },
    });
    const matched = policies.find((p) => count >= p.thresholdCount);
    if (!matched) return;
    await this.notify(
      studentId,
      'infraction_policy',
      'إجراء تقصير (حسب الإعدادات)',
      matched.actionLabel ||
        `تم بلوغ عتبة ${matched.thresholdCount} — إجراء: ${matched.action}`,
      {
        action: matched.action,
        thresholdCount: matched.thresholdCount,
        infractionType: type,
        count,
      },
    );
    if (matched.action === InfractionAction.FREEZE) {
      await this.users.update(studentId, { status: UserStatus.PAUSED });
    } else if (matched.action === InfractionAction.REMOVE) {
      await this.users.update(studentId, { status: UserStatus.SUSPENDED });
      const membership = await this.memberships.findOne({
        where: { userId: studentId, leftAt: IsNull() },
      });
      if (membership) {
        membership.leftAt = new Date();
        membership.leaveReason = `infraction_policy:${matched.id}`;
        await this.memberships.save(membership);
        const group = await this.groups.findOne({
          where: { id: membership.groupId },
        });
        if (!group) throw new NotFoundException('المجموعة غير موجودة');
        group.currentStudentCount = Math.max(0, group.currentStudentCount - 1);
        if (group.status === GroupStatus.FULL) group.status = GroupStatus.OPEN;
        await this.groups.save(group);
      }
    }
  }

  weekBoundsForDate(isoDate: string) {
    const d = new Date(`${isoDate}T12:00:00Z`);
    const utcDay = d.getUTCDay(); // 0=Sun … 6=Sat
    const offsetFromSat = utcDay === 6 ? 0 : utcDay + 1;
    const sat = new Date(d);
    sat.setUTCDate(d.getUTCDate() - offsetFromSat);
    const fri = new Date(sat);
    fri.setUTCDate(sat.getUTCDate() + 6);
    const iso = (x: Date) => x.toISOString().slice(0, 10);
    return { weekStart: iso(sat), weekEnd: iso(fri) };
  }

  eachDateInclusive(start: string, end: string): string[] {
    const out: string[] = [];
    const d = new Date(`${start}T12:00:00Z`);
    const last = new Date(`${end}T12:00:00Z`);
    while (d.getTime() <= last.getTime()) {
      out.push(d.toISOString().slice(0, 10));
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return out;
  }

  previousWeekBounds(timezone: string) {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    });
    const parts = Object.fromEntries(
      fmt.formatToParts(new Date()).map((p) => [p.type, p.value]),
    );
    const today = new Date(
      `${parts.year}-${parts.month}-${parts.day}T12:00:00Z`,
    );
    const weekday = parts.weekday; // Mon, Tue, ...
    const map: Record<string, number> = {
      Sat: 0,
      Sun: 1,
      Mon: 2,
      Tue: 3,
      Wed: 4,
      Thu: 5,
      Fri: 6,
    };
    const offset = map[weekday] ?? 0;
    // Start of current week (Saturday)
    const currentSat = new Date(today);
    currentSat.setUTCDate(today.getUTCDate() - offset);
    // Previous week: Sat..Fri before current Saturday
    const prevSat = new Date(currentSat);
    prevSat.setUTCDate(currentSat.getUTCDate() - 7);
    const prevFri = new Date(prevSat);
    prevFri.setUTCDate(prevSat.getUTCDate() + 6);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    return { weekStart: iso(prevSat), weekEnd: iso(prevFri) };
  }

  async unreadNotificationCount(userId: string) {
    return this.notifications.count({
      where: { recipientId: userId, readAt: IsNull() },
    });
  }

  requireStaff(actor: User) {
    if (
      ![UserRole.TEACHER, UserRole.SUPERVISOR, UserRole.ADMIN].includes(
        actor.role,
      )
    ) {
      throw new ForbiddenException('صلاحية الموظفين فقط');
    }
  }

  requireTeacher(actor: User) {
    if (actor.role !== UserRole.TEACHER) {
      throw new ForbiddenException('صلاحية المعلم فقط');
    }
  }

  requireSupervisor(actor: User) {
    if (![UserRole.SUPERVISOR, UserRole.ADMIN].includes(actor.role)) {
      throw new ForbiddenException('صلاحية المشرف فقط');
    }
  }

  isSupervisor(actor: User) {
    return [UserRole.SUPERVISOR, UserRole.ADMIN].includes(actor.role);
  }
}
