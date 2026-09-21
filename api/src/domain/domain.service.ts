import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  GroupStatus,
  InfractionType,
  JoinRequestStatus,
  NoteVisibility,
  UserRole,
  UserStatus,
  AttendanceStatus,
  ExcuseRequestStatus,
  InfractionAction,
} from '../common/enums';
import { User } from '../entities/user.entity';
import { Group } from '../entities/group.entity';
import { GroupMembership } from '../entities/group-membership.entity';
import { JoinRequest } from '../entities/join-request.entity';
import { DailyReport } from '../entities/daily-report.entity';
import { WeeklyReport } from '../entities/weekly-report.entity';
import { Attendance } from '../entities/attendance.entity';
import { AbsenceExcuseRequest } from '../entities/absence-excuse-request.entity';
import { StudentNote } from '../entities/student-note.entity';
import { Infraction } from '../entities/infraction.entity';
import { InfractionPolicy } from '../entities/infraction-policy.entity';
import { StudentQuota } from '../entities/student-quota.entity';
import { NotificationStub } from '../entities/notification-stub.entity';
import { ProgramContent } from '../entities/program-content.entity';
import { ReportDeadlineConfig } from '../entities/report-deadline-config.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { PushService } from './push.service';

@Injectable()
export class DomainService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Group) private readonly groups: Repository<Group>,
    @InjectRepository(GroupMembership)
    private readonly memberships: Repository<GroupMembership>,
    @InjectRepository(JoinRequest)
    private readonly joinRequests: Repository<JoinRequest>,
    @InjectRepository(DailyReport)
    private readonly dailyReports: Repository<DailyReport>,
    @InjectRepository(WeeklyReport)
    private readonly weeklyReports: Repository<WeeklyReport>,
    @InjectRepository(Attendance)
    private readonly attendance: Repository<Attendance>,
    @InjectRepository(AbsenceExcuseRequest)
    private readonly excuses: Repository<AbsenceExcuseRequest>,
    @InjectRepository(StudentNote)
    private readonly notes: Repository<StudentNote>,
    @InjectRepository(Infraction)
    private readonly infractions: Repository<Infraction>,
    @InjectRepository(InfractionPolicy)
    private readonly policies: Repository<InfractionPolicy>,
    @InjectRepository(StudentQuota)
    private readonly quotas: Repository<StudentQuota>,
    @InjectRepository(NotificationStub)
    private readonly notifications: Repository<NotificationStub>,
    @InjectRepository(ProgramContent)
    private readonly content: Repository<ProgramContent>,
    @InjectRepository(ReportDeadlineConfig)
    private readonly deadlines: Repository<ReportDeadlineConfig>,
    @InjectRepository(AuditLog)
    private readonly audit: Repository<AuditLog>,
    private readonly push: PushService,
  ) {}

  private async auditLog(
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

  private async notify(
    recipientId: string,
    type: string,
    title: string,
    body: string,
    payload?: Record<string, unknown>,
  ) {
    await this.push.notify(recipientId, type, title, body, payload);
  }

  /** Teacher of student's active group + all supervisors/admins. */
  private async notifyStaffAboutStudent(
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

  registerDeviceToken(actor: User, token: string, platform?: string) {
    return this.push.registerToken(actor.id, token, platform || 'fcm');
  }

  unregisterDeviceToken(actor: User, token: string) {
    return this.push.unregisterToken(actor.id, token);
  }

  listUsers(actor: User) {
    this.requireStaff(actor);
    return this.users.find({ order: { createdAt: 'DESC' } });
  }

  async createGroup(
    actor: User,
    input: {
      name: string;
      teacherId: string;
      gender: string;
      seatCount: number;
      weeklySessionDay: string;
      weeklySessionTime: string;
      whatsappUrl?: string;
      description?: string;
    },
  ) {
    this.requireSupervisor(actor);
    const teacher = await this.users.findOne({ where: { id: input.teacherId } });
    if (!teacher || teacher.role !== UserRole.TEACHER) {
      throw new BadRequestException('المعلم غير صالح');
    }
    const group = await this.groups.save(
      this.groups.create({
        name: input.name,
        teacher,
        teacherId: teacher.id,
        gender: input.gender as never,
        seatCount: input.seatCount,
        weeklySessionDay: input.weeklySessionDay,
        weeklySessionTime: input.weeklySessionTime,
        whatsappUrl: input.whatsappUrl ?? null,
        description: input.description ?? null,
        status: GroupStatus.OPEN,
      }),
    );
    await this.auditLog(actor.id, 'group.create', 'group', group.id, null, {
      name: group.name,
    });
    return group;
  }

  listGroups() {
    return this.groups.find({ order: { createdAt: 'DESC' } });
  }

  async getGroup(id: string) {
    const group = await this.groups.findOne({ where: { id } });
    if (!group) throw new NotFoundException('المجموعة غير موجودة');
    return group;
  }

  async requestJoin(actor: User, groupId: string) {
    if (actor.role !== UserRole.STUDENT) {
      throw new ForbiddenException('الطلبة فقط يطلبون الانضمام');
    }
    const group = await this.getGroup(groupId);
    if (group.status !== GroupStatus.OPEN) {
      throw new BadRequestException('المجموعة غير مفتوحة للانضمام');
    }
    const active = await this.memberships.findOne({
      where: { userId: actor.id, leftAt: IsNull() },
    });
    if (active) throw new BadRequestException('أنت منضم لمجموعة حالياً');
    const pending = await this.joinRequests.findOne({
      where: {
        studentId: actor.id,
        groupId,
        status: JoinRequestStatus.PENDING,
      },
    });
    if (pending) throw new BadRequestException('لديك طلب قيد المراجعة');
    const req = await this.joinRequests.save(
      this.joinRequests.create({
        student: actor,
        studentId: actor.id,
        group,
        groupId,
        status: JoinRequestStatus.PENDING,
      }),
    );
    await this.users.update(actor.id, { status: UserStatus.PENDING_GROUP });
    const supervisors = await this.users.find({
      where: [{ role: UserRole.SUPERVISOR }, { role: UserRole.ADMIN }],
    });
    for (const s of supervisors) {
      await this.notify(
        s.id,
        'join_request',
        'طلب انضمام جديد',
        `${actor.firstName} ${actor.lastName} طلب الانضمام إلى ${group.name}`,
        { joinRequestId: req.id },
      );
    }
    return req;
  }

  listJoinRequests(actor: User) {
    this.requireStaff(actor);
    return this.joinRequests.find({ order: { createdAt: 'DESC' } });
  }

  async reviewJoinRequest(
    actor: User,
    id: string,
    accept: boolean,
    reviewNote?: string,
  ) {
    this.requireSupervisor(actor);
    const req = await this.joinRequests.findOne({ where: { id } });
    if (!req || req.status !== JoinRequestStatus.PENDING) {
      throw new BadRequestException('الطلب غير صالح للمراجعة');
    }
    const before = { status: req.status };
    if (accept) {
      const group = await this.getGroup(req.groupId);
      if (group.currentStudentCount >= group.seatCount) {
        throw new BadRequestException('المجموعة ممتلئة');
      }
      req.status = JoinRequestStatus.ACCEPTED;
      req.reviewedById = actor.id;
      req.reviewNote = reviewNote ?? null;
      await this.joinRequests.save(req);
      await this.memberships.save(
        this.memberships.create({
          userId: req.studentId,
          groupId: req.groupId,
          joinedAt: new Date(),
          leftAt: null,
        }),
      );
      group.currentStudentCount += 1;
      if (group.currentStudentCount >= group.seatCount) {
        group.status = GroupStatus.FULL;
      }
      await this.groups.save(group);
      await this.users.update(req.studentId, { status: UserStatus.ACTIVE });
      await this.notify(
        req.studentId,
        'join_accepted',
        'تم قبول طلبك',
        `تم قبولك في مجموعة ${group.name}`,
        { groupId: group.id, whatsappUrl: group.whatsappUrl },
      );
    } else {
      req.status = JoinRequestStatus.REJECTED;
      req.reviewedById = actor.id;
      req.reviewNote = reviewNote ?? null;
      await this.joinRequests.save(req);
      await this.users.update(req.studentId, { status: UserStatus.NEW });
      await this.notify(
        req.studentId,
        'join_rejected',
        'تم رفض طلب الانضمام',
        reviewNote || 'تم رفض طلب الانضمام',
        { joinRequestId: req.id },
      );
    }
    await this.auditLog(actor.id, 'join_request.review', 'join_request', id, before, {
      status: req.status,
    });
    return req;
  }

  async myMembership(actor: User) {
    return this.memberships.findOne({
      where: { userId: actor.id, leftAt: IsNull() },
    });
  }

  membershipHistory(actor: User, studentId?: string) {
    const id =
      actor.role === UserRole.STUDENT ? actor.id : studentId || actor.id;
    if (actor.role === UserRole.STUDENT && studentId && studentId !== actor.id) {
      throw new ForbiddenException();
    }
    return this.memberships.find({
      where: { userId: id },
      order: { joinedAt: 'DESC' },
    });
  }

  async submitDailyReport(
    actor: User,
    input: {
      reportDate: string;
      memorizedQuota: boolean;
      memorizationFrom?: string;
      memorizationTo?: string;
      reviewPortion?: string;
      reviewFrom?: string;
      reviewTo?: string;
      completedFiftyRepetitions: boolean;
      repeatedInOneSitting: boolean;
      readTafsir: boolean;
    },
  ) {
    if (actor.role !== UserRole.STUDENT) {
      throw new ForbiddenException('الطلبة فقط يرسلون التقارير اليومية');
    }
    const existing = await this.dailyReports.findOne({
      where: { studentId: actor.id, reportDate: input.reportDate },
    });
    if (existing) {
      throw new BadRequestException('لا يمكن تعديل التقرير بعد الإرسال');
    }
    const report = await this.dailyReports.save(
      this.dailyReports.create({
        student: actor,
        studentId: actor.id,
        reportDate: input.reportDate,
        memorizedQuota: input.memorizedQuota,
        memorizationFrom: input.memorizationFrom ?? null,
        memorizationTo: input.memorizationTo ?? null,
        reviewPortion: input.reviewPortion ?? null,
        reviewFrom: input.reviewFrom ?? null,
        reviewTo: input.reviewTo ?? null,
        completedFiftyRepetitions: input.completedFiftyRepetitions,
        repeatedInOneSitting: input.repeatedInOneSitting,
        readTafsir: input.readTafsir,
        submittedAt: new Date(),
      }),
    );
    await this.evaluateContentInfractions(actor.id, report);
    await this.notifyStaffAboutStudent(
      actor.id,
      'daily_report_submitted',
      'تقرير يومي جديد',
      `${actor.firstName} ${actor.lastName} أرسل تقرير ${input.reportDate}`,
      { reportId: report.id, reportDate: input.reportDate },
    );
    return report;
  }

  /**
   * Visibility (locked): teachers + supervisors only for others' reports.
   * Students see only their own. Peers never see classmate submit status.
   * No missing-by-deadline infractions in MVP.
   */
  async listDailyReports(
    actor: User,
    filters: { studentId?: string; reportDate?: string; groupId?: string },
  ) {
    if (actor.role === UserRole.STUDENT) {
      return this.dailyReports.find({
        where: {
          studentId: actor.id,
          ...(filters.reportDate ? { reportDate: filters.reportDate } : {}),
        },
        order: { reportDate: 'DESC' },
      });
    }
    this.requireStaff(actor);
    if (filters.studentId) {
      return this.dailyReports.find({
        where: {
          studentId: filters.studentId,
          ...(filters.reportDate ? { reportDate: filters.reportDate } : {}),
        },
        order: { reportDate: 'DESC' },
      });
    }
    if (filters.groupId || actor.role === UserRole.TEACHER) {
      let groupId = filters.groupId;
      if (actor.role === UserRole.TEACHER) {
        const myGroups = await this.groups.find({
          where: { teacherId: actor.id },
        });
        const ids = myGroups.map((g) => g.id);
        if (groupId && !ids.includes(groupId)) {
          throw new ForbiddenException();
        }
        if (!groupId && ids.length === 1) groupId = ids[0];
        if (!groupId) {
          const memberIds = (
            await this.memberships.find({
              where: ids.map((id) => ({ groupId: id, leftAt: IsNull() })),
            })
          ).map((m) => m.userId);
          if (!memberIds.length) return [];
          return this.dailyReports
            .createQueryBuilder('r')
            .where('r.studentId IN (:...memberIds)', { memberIds })
            .orderBy('r.reportDate', 'DESC')
            .getMany();
        }
      }
      const members = await this.memberships.find({
        where: { groupId: groupId!, leftAt: IsNull() },
      });
      const memberIds = members.map((m) => m.userId);
      if (!memberIds.length) return [];
      const qb = this.dailyReports
        .createQueryBuilder('r')
        .where('r.studentId IN (:...memberIds)', { memberIds });
      if (filters.reportDate) {
        qb.andWhere('r.reportDate = :d', { d: filters.reportDate });
      }
      return qb.orderBy('r.reportDate', 'DESC').getMany();
    }
    return this.dailyReports.find({
      where: filters.reportDate ? { reportDate: filters.reportDate } : {},
      order: { reportDate: 'DESC' },
      take: 200,
    });
  }

  private async evaluateContentInfractions(studentId: string, report: DailyReport) {
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

  private async recordInfraction(
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
  private async applyConfigurableConsequences(
    studentId: string,
    type: InfractionType,
  ) {
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
        const group = await this.getGroup(membership.groupId);
        group.currentStudentCount = Math.max(0, group.currentStudentCount - 1);
        if (group.status === GroupStatus.FULL) group.status = GroupStatus.OPEN;
        await this.groups.save(group);
      }
    }
  }

  listInfractions(actor: User, studentId?: string) {
    if (actor.role === UserRole.STUDENT) {
      return this.infractions.find({
        where: { studentId: actor.id },
        order: { occurredOn: 'DESC' },
      });
    }
    this.requireStaff(actor);
    return this.infractions.find({
      where: studentId ? { studentId } : {},
      order: { occurredOn: 'DESC' },
      take: 300,
    });
  }

  listPolicies(actor: User) {
    this.requireSupervisor(actor);
    return this.policies.find({ order: { infractionType: 'ASC', thresholdCount: 'ASC' } });
  }

  async upsertPolicy(
    actor: User,
    input: {
      id?: string;
      infractionType: InfractionType;
      thresholdCount: number;
      action: InfractionAction;
      actionLabel?: string;
      enabled?: boolean;
    },
  ) {
    this.requireSupervisor(actor);
    if (input.id) {
      const existing = await this.policies.findOne({ where: { id: input.id } });
      if (!existing) throw new NotFoundException();
      Object.assign(existing, {
        infractionType: input.infractionType,
        thresholdCount: input.thresholdCount,
        action: input.action,
        actionLabel: input.actionLabel ?? existing.actionLabel,
        enabled: input.enabled ?? existing.enabled,
      });
      return this.policies.save(existing);
    }
    return this.policies.save(
      this.policies.create({
        infractionType: input.infractionType,
        thresholdCount: input.thresholdCount,
        action: input.action,
        actionLabel: input.actionLabel ?? null,
        enabled: input.enabled ?? true,
      }),
    );
  }

  async setQuota(
    actor: User,
    studentId: string,
    dailyQuotaDescription: string,
    requiredRepetitions = 50,
  ) {
    this.requireStaff(actor);
    let quota = await this.quotas.findOne({ where: { studentId } });
    if (!quota) {
      quota = this.quotas.create({
        studentId,
        dailyQuotaDescription,
        requiredRepetitions,
        setById: actor.id,
      });
    } else {
      quota.dailyQuotaDescription = dailyQuotaDescription;
      quota.requiredRepetitions = requiredRepetitions;
      quota.setById = actor.id;
    }
    return this.quotas.save(quota);
  }

  getQuota(actor: User, studentId?: string) {
    const id =
      actor.role === UserRole.STUDENT ? actor.id : studentId || actor.id;
    if (actor.role === UserRole.STUDENT && studentId && studentId !== actor.id) {
      throw new ForbiddenException();
    }
    return this.quotas.findOne({ where: { studentId: id } });
  }

  async recordAttendance(
    actor: User,
    input: {
      studentId: string;
      groupId: string;
      sessionDate: string;
      status: AttendanceStatus;
      arrivedLate?: boolean;
      leftEarly?: boolean;
      note?: string;
    },
  ) {
    this.requireStaff(actor);
    let row = await this.attendance.findOne({
      where: {
        studentId: input.studentId,
        groupId: input.groupId,
        sessionDate: input.sessionDate,
      },
    });
    if (!row) {
      row = this.attendance.create({
        studentId: input.studentId,
        groupId: input.groupId,
        sessionDate: input.sessionDate,
        status: input.status,
        arrivedLate: !!input.arrivedLate,
        leftEarly: !!input.leftEarly,
        note: input.note ?? null,
        recordedById: actor.id,
      });
    } else {
      row.status = input.status;
      row.arrivedLate = !!input.arrivedLate;
      row.leftEarly = !!input.leftEarly;
      row.note = input.note ?? null;
      row.recordedById = actor.id;
    }
    const saved = await this.attendance.save(row);
    if (input.status === AttendanceStatus.UNEXCUSED) {
      await this.recordInfraction(
        input.studentId,
        InfractionType.UNEXCUSED_ABSENCE,
        'attendance',
        input.sessionDate,
        'غياب بدون عذر',
      );
    }
    if (
      input.status === AttendanceStatus.EXCUSED ||
      input.status === AttendanceStatus.UNEXCUSED
    ) {
      const student = await this.users.findOne({
        where: { id: input.studentId },
      });
      const label =
        input.status === AttendanceStatus.EXCUSED
          ? 'غياب بعذر'
          : 'غياب بلا عذر';
      await this.notifyStaffAboutStudent(
        input.studentId,
        'attendance_absence',
        label,
        `${student?.firstName ?? 'طالب'} — ${input.sessionDate}`,
        {
          attendanceId: saved.id,
          sessionDate: input.sessionDate,
          status: input.status,
        },
        actor.id,
      );
      if (student) {
        await this.notify(
          student.id,
          'attendance_absence',
          label,
          `تم تسجيل ${label} لتاريخ ${input.sessionDate}`,
          { sessionDate: input.sessionDate, status: input.status },
        );
      }
    }
    await this.auditLog(
      actor.id,
      'attendance.record',
      'attendance',
      saved.id,
      null,
      { status: saved.status },
    );
    return saved;
  }

  listAttendance(actor: User, groupId?: string, sessionDate?: string) {
    this.requireStaff(actor);
    return this.attendance.find({
      where: {
        ...(groupId ? { groupId } : {}),
        ...(sessionDate ? { sessionDate } : {}),
      },
      order: { sessionDate: 'DESC' },
      take: 300,
    });
  }

  async requestExcuse(
    actor: User,
    input: { groupId: string; sessionDate: string; reason: string },
  ) {
    if (actor.role !== UserRole.STUDENT) throw new ForbiddenException();
    const row = await this.excuses.save(
      this.excuses.create({
        studentId: actor.id,
        groupId: input.groupId,
        sessionDate: input.sessionDate,
        reason: input.reason,
        status: ExcuseRequestStatus.PENDING,
      }),
    );
    await this.notifyStaffAboutStudent(
      actor.id,
      'excuse_submitted',
      'طلب عذر غياب',
      `${actor.firstName} ${actor.lastName}: ${input.reason}`,
      {
        excuseId: row.id,
        sessionDate: input.sessionDate,
        groupId: input.groupId,
      },
    );
    return row;
  }

  async reviewExcuse(actor: User, id: string, approve: boolean) {
    this.requireStaff(actor);
    const row = await this.excuses.findOne({ where: { id } });
    if (!row || row.status !== ExcuseRequestStatus.PENDING) {
      throw new BadRequestException('الطلب غير صالح');
    }
    row.status = approve
      ? ExcuseRequestStatus.APPROVED
      : ExcuseRequestStatus.REJECTED;
    row.reviewedById = actor.id;
    await this.excuses.save(row);
    if (approve) {
      await this.recordAttendance(actor, {
        studentId: row.studentId,
        groupId: row.groupId,
        sessionDate: row.sessionDate,
        status: AttendanceStatus.EXCUSED,
        note: row.reason,
      });
    }
    return row;
  }

  listExcuses(actor: User) {
    if (actor.role === UserRole.STUDENT) {
      return this.excuses.find({
        where: { studentId: actor.id },
        order: { createdAt: 'DESC' },
      });
    }
    this.requireStaff(actor);
    return this.excuses.find({ order: { createdAt: 'DESC' } });
  }

  async addNote(
    actor: User,
    input: {
      studentId: string;
      body: string;
      visibility: NoteVisibility;
      noteDate: string;
    },
  ) {
    this.requireStaff(actor);
    const note = await this.notes.save(
      this.notes.create({
        studentId: input.studentId,
        authorId: actor.id,
        body: input.body,
        visibility: input.visibility,
        noteDate: input.noteDate,
      }),
    );
    if (input.visibility === NoteVisibility.STUDENT_VISIBLE) {
      await this.notify(
        input.studentId,
        'teacher_note',
        'ملاحظة جديدة من المعلم',
        input.body.slice(0, 120),
        { noteId: note.id },
      );
    }
    return note;
  }

  listNotes(actor: User, studentId?: string) {
    if (actor.role === UserRole.STUDENT) {
      return this.notes.find({
        where: {
          studentId: actor.id,
          visibility: NoteVisibility.STUDENT_VISIBLE,
        },
        order: { noteDate: 'DESC' },
      });
    }
    this.requireStaff(actor);
    return this.notes.find({
      where: studentId ? { studentId } : {},
      order: { noteDate: 'DESC' },
      take: 200,
    });
  }

  async generateWeeklyReport(
    actor: User,
    studentId: string,
    weekStartDate: string,
    weekEndDate: string,
  ) {
    this.requireStaff(actor);
    const membership = await this.memberships.findOne({
      where: { userId: studentId, leftAt: IsNull() },
    });
    const dailies = await this.dailyReports
      .createQueryBuilder('r')
      .where('r.studentId = :studentId', { studentId })
      .andWhere('r.reportDate >= :start', { start: weekStartDate })
      .andWhere('r.reportDate <= :end', { end: weekEndDate })
      .getMany();
    const att = membership
      ? await this.attendance
          .createQueryBuilder('a')
          .where('a.studentId = :studentId', { studentId })
          .andWhere('a.groupId = :groupId', { groupId: membership.groupId })
          .andWhere('a.sessionDate >= :start', { start: weekStartDate })
          .andWhere('a.sessionDate <= :end', { end: weekEndDate })
          .getMany()
      : [];
    let existing = await this.weeklyReports.findOne({
      where: { studentId, weekStartDate },
    });
    const payload = {
      studentId,
      groupId: membership?.groupId ?? null,
      weekStartDate,
      weekEndDate,
      dailyReportsSubmitted: dailies.length,
      quotaDaysMet: dailies.filter((d) => d.memorizedQuota).length,
      fiftyRepsDaysMet: dailies.filter((d) => d.completedFiftyRepetitions).length,
      presentSessions: att.filter((a) => a.status === AttendanceStatus.PRESENT)
        .length,
      excusedAbsences: att.filter((a) => a.status === AttendanceStatus.EXCUSED)
        .length,
      unexcusedAbsences: att.filter(
        (a) => a.status === AttendanceStatus.UNEXCUSED,
      ).length,
      summaryJson: {
        dailyReportIds: dailies.map((d) => d.id),
        attendanceIds: att.map((a) => a.id),
      },
      generatedAt: new Date(),
    };
    if (existing) {
      Object.assign(existing, payload);
    } else {
      existing = this.weeklyReports.create(payload);
    }
    const saved = await this.weeklyReports.save(existing);
    await this.notify(
      studentId,
      'weekly_report',
      'تقرير أسبوعي جاهز للتأكيد',
      `الأسبوع ${weekStartDate} — ${weekEndDate}`,
      { weeklyReportId: saved.id },
    );
    return saved;
  }

  async confirmWeeklyReport(actor: User, id: string) {
    const report = await this.weeklyReports.findOne({ where: { id } });
    if (!report) throw new NotFoundException();
    if (actor.role === UserRole.STUDENT && report.studentId !== actor.id) {
      throw new ForbiddenException();
    }
    if (actor.role !== UserRole.STUDENT) this.requireStaff(actor);
    report.studentConfirmedAt = new Date();
    return this.weeklyReports.save(report);
  }

  listWeeklyReports(actor: User, studentId?: string) {
    if (actor.role === UserRole.STUDENT) {
      return this.weeklyReports.find({
        where: { studentId: actor.id },
        order: { weekStartDate: 'DESC' },
      });
    }
    this.requireStaff(actor);
    return this.weeklyReports.find({
      where: studentId ? { studentId } : {},
      order: { weekStartDate: 'DESC' },
      take: 100,
    });
  }

  async changeGroup(
    actor: User,
    studentId: string,
    newGroupId: string,
    reason?: string,
  ) {
    this.requireSupervisor(actor);
    const current = await this.memberships.findOne({
      where: { userId: studentId, leftAt: IsNull() },
    });
    if (current) {
      current.leftAt = new Date();
      current.leaveReason = reason || 'group_change';
      await this.memberships.save(current);
      const oldGroup = await this.getGroup(current.groupId);
      oldGroup.currentStudentCount = Math.max(0, oldGroup.currentStudentCount - 1);
      if (oldGroup.status === GroupStatus.FULL) oldGroup.status = GroupStatus.OPEN;
      await this.groups.save(oldGroup);
    }
    const group = await this.getGroup(newGroupId);
    if (group.currentStudentCount >= group.seatCount) {
      throw new BadRequestException('المجموعة الجديدة ممتلئة');
    }
    const membership = await this.memberships.save(
      this.memberships.create({
        userId: studentId,
        groupId: newGroupId,
        joinedAt: new Date(),
        leftAt: null,
      }),
    );
    group.currentStudentCount += 1;
    if (group.currentStudentCount >= group.seatCount) {
      group.status = GroupStatus.FULL;
    }
    await this.groups.save(group);
    await this.users.update(studentId, { status: UserStatus.ACTIVE });
    await this.auditLog(actor.id, 'membership.change_group', 'membership', membership.id, null, {
      studentId,
      newGroupId,
    });
    return membership;
  }

  listProgramContent() {
    return this.content.find({ order: { key: 'ASC' } });
  }

  async upsertProgramContent(
    actor: User,
    input: { key: string; title: string; body: string; videoUrl?: string },
  ) {
    this.requireSupervisor(actor);
    let row = await this.content.findOne({ where: { key: input.key } });
    if (!row) {
      row = this.content.create(input);
    } else {
      Object.assign(row, {
        title: input.title,
        body: input.body,
        videoUrl: input.videoUrl ?? row.videoUrl,
      });
    }
    return this.content.save(row);
  }

  getDeadlineConfig() {
    return this.deadlines.find({ take: 1 });
  }

  async upsertDeadlineConfig(
    actor: User,
    input: {
      enabled: boolean;
      timezone: string;
      closeTimeLocal: string;
      reminderMinutesBefore?: number;
      notes?: string;
    },
  ) {
    this.requireSupervisor(actor);
    const rows = await this.deadlines.find({ take: 1 });
    let row = rows[0];
    if (!row) {
      row = this.deadlines.create({
        enabled: input.enabled,
        timezone: input.timezone,
        closeTimeLocal: input.closeTimeLocal,
        reminderMinutesBefore: input.reminderMinutesBefore ?? 60,
        notes: input.notes ?? null,
      });
    } else {
      Object.assign(row, {
        enabled: input.enabled,
        timezone: input.timezone,
        closeTimeLocal: input.closeTimeLocal,
        reminderMinutesBefore:
          input.reminderMinutesBefore ?? row.reminderMinutesBefore ?? 60,
        notes: input.notes ?? row.notes,
      });
    }
    // Reminders fire when enabled; missing-by-deadline auto-infractions stay off.
    return this.deadlines.save(row);
  }

  myNotifications(actor: User) {
    return this.notifications.find({
      where: { recipientId: actor.id },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async teacherDashboard(actor: User) {
    if (actor.role !== UserRole.TEACHER && !this.isSupervisor(actor)) {
      throw new ForbiddenException();
    }
    const groups =
      actor.role === UserRole.TEACHER
        ? await this.groups.find({ where: { teacherId: actor.id } })
        : await this.groups.find();
    const today = new Date().toISOString().slice(0, 10);
    const result = [];
    for (const g of groups) {
      const members = await this.memberships.find({
        where: { groupId: g.id, leftAt: IsNull() },
      });
      const memberIds = members.map((m) => m.userId);
      const submittedToday = memberIds.length
        ? await this.dailyReports
            .createQueryBuilder('r')
            .where('r.studentId IN (:...memberIds)', { memberIds })
            .andWhere('r.reportDate = :today', { today })
            .getCount()
        : 0;
      const openInfractions = memberIds.length
        ? await this.infractions
            .createQueryBuilder('i')
            .where('i.studentId IN (:...memberIds)', { memberIds })
            .andWhere('i.resolved = false')
            .getCount()
        : 0;
      result.push({
        group: g,
        studentCount: members.length,
        submittedToday,
        missingToday: Math.max(0, members.length - submittedToday),
        openInfractions,
        students: members.map((m) => ({
          id: m.user.id,
          name: `${m.user.firstName} ${m.user.lastName}`,
          phone: m.user.phone,
          status: m.user.status,
        })),
      });
    }
    return { today, groups: result };
  }

  async supervisorDashboard(actor: User) {
    this.requireSupervisor(actor);
    const today = new Date().toISOString().slice(0, 10);
    const [
      students,
      teachers,
      groups,
      pendingJoins,
      activeStudents,
      openInfractions,
      reportsToday,
    ] = await Promise.all([
      this.users.count({ where: { role: UserRole.STUDENT } }),
      this.users.count({ where: { role: UserRole.TEACHER } }),
      this.groups.count(),
      this.joinRequests.count({ where: { status: JoinRequestStatus.PENDING } }),
      this.users.count({
        where: { role: UserRole.STUDENT, status: UserStatus.ACTIVE },
      }),
      this.infractions.count({ where: { resolved: false } }),
      this.dailyReports.count({ where: { reportDate: today } }),
    ]);
    return {
      today,
      students,
      teachers,
      groups,
      pendingJoins,
      activeStudents,
      openInfractions,
      reportsToday,
    };
  }

  private requireStaff(actor: User) {
    if (
      ![UserRole.TEACHER, UserRole.SUPERVISOR, UserRole.ADMIN].includes(
        actor.role,
      )
    ) {
      throw new ForbiddenException('صلاحية الموظفين فقط');
    }
  }

  private requireSupervisor(actor: User) {
    if (![UserRole.SUPERVISOR, UserRole.ADMIN].includes(actor.role)) {
      throw new ForbiddenException('صلاحية المشرف فقط');
    }
  }

  private isSupervisor(actor: User) {
    return [UserRole.SUPERVISOR, UserRole.ADMIN].includes(actor.role);
  }
}
