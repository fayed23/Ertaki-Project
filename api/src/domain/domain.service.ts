import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { In, IsNull, Repository } from 'typeorm';
import {
  GroupGender,
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
import { TrimestrialReport } from '../entities/trimestrial-report.entity';
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
    @InjectRepository(TrimestrialReport)
    private readonly trimestrialReports: Repository<TrimestrialReport>,
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

  /** Teacher of student's active group only (not supervisors). */
  private async notifyTeacherAboutStudent(
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

  async listPendingAccounts(actor: User) {
    this.requireSupervisor(actor);
    const rows = await this.users.find({
      where: [
        { status: UserStatus.PENDING_APPROVAL },
        { status: UserStatus.REJECTED },
      ],
      order: { createdAt: 'DESC' },
    });
    rows.sort((a, b) => {
      const ap = a.status === UserStatus.PENDING_APPROVAL ? 0 : 1;
      const bp = b.status === UserStatus.PENDING_APPROVAL ? 0 : 1;
      return ap - bp;
    });
    return rows.map(({ passwordHash: _, ...safe }) => safe);
  }

  async reviewAccount(
    actor: User,
    userId: string,
    approve: boolean,
    reviewNote?: string,
  ) {
    this.requireSupervisor(actor);
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('المستخدم غير موجود');
    if (
      ![UserRole.STUDENT, UserRole.TEACHER].includes(user.role) ||
      user.status !== UserStatus.PENDING_APPROVAL
    ) {
      throw new BadRequestException('الحساب غير صالح للمراجعة');
    }
    const before = {
      status: user.status,
      isActive: user.isActive,
      accountReviewNote: user.accountReviewNote,
    };
    if (approve) {
      user.isActive = true;
      user.accountReviewNote = reviewNote?.trim() || null;
      user.status =
        user.role === UserRole.TEACHER ? UserStatus.ACTIVE : UserStatus.NEW;
      await this.users.save(user);
      await this.notify(
        user.id,
        'account_approved',
        'تم تفعيل حسابك',
        'وافق المشرف على حسابك — يمكنك تسجيل الدخول الآن',
        { userId: user.id, role: user.role },
      );
    } else {
      user.isActive = false;
      user.status = UserStatus.REJECTED;
      user.accountReviewNote = reviewNote?.trim() || null;
      await this.users.save(user);
      const reason = user.accountReviewNote
        ? ` السبب: ${user.accountReviewNote}`
        : '';
      await this.notify(
        user.id,
        'account_rejected',
        'تم رفض تفعيل الحساب',
        `رفض المشرف تفعيل حسابك.${reason}`,
        { userId: user.id, role: user.role },
      );
    }
    await this.auditLog(
      actor.id,
      'account.review',
      'user',
      user.id,
      before,
      {
        status: user.status,
        isActive: user.isActive,
        accountReviewNote: user.accountReviewNote,
      },
    );
    const { passwordHash: _, ...safe } = user;
    return safe;
  }

  async createGroup(
    actor: User,
    input: {
      name: string;
      teacherId?: string;
      gender: string;
      seatCount?: number;
      weeklySessionDay?: string;
      weeklySessionTime?: string;
      sessionStartTime?: string;
      sessionEndTime?: string;
      whatsappUrl?: string;
      description?: string;
    },
  ) {
    const isSupervisor = this.isSupervisor(actor);
    const isTeacher = actor.role === UserRole.TEACHER;
    if (!isSupervisor && !isTeacher) {
      throw new ForbiddenException('صلاحية إنشاء المجموعات غير متاحة');
    }
    let teacherId = input.teacherId;
    if (isTeacher) {
      teacherId = actor.id;
    }
    if (!teacherId) throw new BadRequestException('المعلم مطلوب');
    const teacher = await this.users.findOne({ where: { id: teacherId } });
    if (!teacher || teacher.role !== UserRole.TEACHER) {
      throw new BadRequestException('المعلم غير صالح');
    }
    const start =
      input.sessionStartTime ||
      input.weeklySessionTime ||
      '20:00';
    const end = input.sessionEndTime || '21:00';
    const status = isSupervisor
      ? GroupStatus.OPEN
      : GroupStatus.PENDING_APPROVAL;
    const group = await this.groups.save(
      this.groups.create({
        name: input.name,
        teacher,
        teacherId: teacher.id,
        gender: input.gender as never,
        seatCount: input.seatCount ?? 20,
        weeklySessionDay: input.weeklySessionDay || 'السبت',
        weeklySessionTime: start,
        sessionStartTime: start,
        sessionEndTime: end,
        whatsappUrl: input.whatsappUrl ?? null,
        description: input.description ?? null,
        status,
      }),
    );
    await this.auditLog(actor.id, 'group.create', 'group', group.id, null, {
      name: group.name,
      status: group.status,
    });
    if (status === GroupStatus.PENDING_APPROVAL) {
      const supervisors = await this.users.find({
        where: [{ role: UserRole.SUPERVISOR }, { role: UserRole.ADMIN }],
      });
      for (const s of supervisors) {
        await this.notify(
          s.id,
          'group_pending_approval',
          'طلب إنشاء مجموعة',
          `${teacher.firstName} طلب إنشاء «${group.name}»`,
          { groupId: group.id },
        );
      }
    }
    return this.enrichGroup(group);
  }

  async reviewGroupCreation(
    actor: User,
    groupId: string,
    approve: boolean,
    reviewNote?: string,
  ) {
    this.requireSupervisor(actor);
    const group = await this.getGroup(groupId);
    if (group.status !== GroupStatus.PENDING_APPROVAL) {
      throw new BadRequestException('المجموعة ليست بانتظار الموافقة');
    }
    if (approve) {
      group.status = GroupStatus.OPEN;
      await this.groups.save(group);
      await this.notify(
        group.teacherId,
        'group_approved',
        'تمت الموافقة على المجموعة',
        `مجموعة «${group.name}» أصبحت مفتوحة للانضمام`,
        { groupId: group.id },
      );
    } else {
      group.status = GroupStatus.CLOSED;
      group.description = [
        group.description || '',
        reviewNote ? `رفض المشرف: ${reviewNote}` : 'رفض المشرف إنشاء المجموعة',
      ]
        .filter(Boolean)
        .join('\n');
      await this.groups.save(group);
      await this.notify(
        group.teacherId,
        'group_rejected',
        'رُفض إنشاء المجموعة',
        reviewNote || `رفض المشرف مجموعة «${group.name}»`,
        { groupId: group.id },
      );
    }
    return this.enrichGroup(group);
  }

  async updateGroup(
    actor: User,
    groupId: string,
    input: {
      name?: string;
      gender?: string;
      seatCount?: number;
      weeklySessionDay?: string;
      weeklySessionTime?: string;
      sessionStartTime?: string;
      sessionEndTime?: string;
      whatsappUrl?: string | null;
      description?: string | null;
    },
  ) {
    const group = await this.getGroup(groupId);
    const isOwnerTeacher =
      actor.role === UserRole.TEACHER && group.teacherId === actor.id;
    if (!isOwnerTeacher && !this.isSupervisor(actor)) {
      throw new ForbiddenException('تعديل المجموعة للمعلم أو المشرف فقط');
    }
    const before = {
      name: group.name,
      gender: group.gender,
      seatCount: group.seatCount,
      weeklySessionDay: group.weeklySessionDay,
      sessionStartTime: group.sessionStartTime,
      sessionEndTime: group.sessionEndTime,
      whatsappUrl: group.whatsappUrl,
      description: group.description,
    };
    if (input.name != null) {
      const name = input.name.trim();
      if (!name) throw new BadRequestException('اسم المجموعة مطلوب');
      group.name = name;
    }
    if (input.seatCount != null) {
      const seats = Number(input.seatCount);
      if (!Number.isFinite(seats) || seats < 1) {
        throw new BadRequestException('عدد المقاعد غير صالح');
      }
      if (seats < group.currentStudentCount) {
        throw new BadRequestException(
          `لا يمكن تقليل المقاعد دون عدد الطلبة الحالي (${group.currentStudentCount})`,
        );
      }
      group.seatCount = seats;
      if (
        group.status === GroupStatus.FULL &&
        group.currentStudentCount < seats
      ) {
        group.status = GroupStatus.OPEN;
      } else if (
        group.status === GroupStatus.OPEN &&
        group.currentStudentCount >= seats
      ) {
        group.status = GroupStatus.FULL;
      }
    }
    if (input.gender != null) {
      if (
        actor.role === UserRole.TEACHER &&
        group.currentStudentCount > 0 &&
        input.gender !== group.gender
      ) {
        throw new BadRequestException(
          'لا يمكن تغيير جنس المجموعة وفيها طلبة — اطلب من المشرف',
        );
      }
      group.gender = input.gender as GroupGender;
    }
    if (input.weeklySessionDay != null) {
      group.weeklySessionDay = input.weeklySessionDay;
    }
    const start =
      input.sessionStartTime ??
      input.weeklySessionTime ??
      undefined;
    if (start != null) {
      group.sessionStartTime = start;
      group.weeklySessionTime = start;
    }
    if (input.sessionEndTime != null) {
      group.sessionEndTime = input.sessionEndTime;
    }
    if (input.whatsappUrl !== undefined) {
      const wa = input.whatsappUrl?.trim() || null;
      group.whatsappUrl = wa;
    }
    if (input.description !== undefined) {
      group.description = input.description?.trim() || null;
    }
    await this.groups.save(group);
    await this.auditLog(
      actor.id,
      'group.update',
      'group',
      group.id,
      before,
      {
        name: group.name,
        gender: group.gender,
        seatCount: group.seatCount,
        weeklySessionDay: group.weeklySessionDay,
        sessionStartTime: group.sessionStartTime,
        sessionEndTime: group.sessionEndTime,
        whatsappUrl: group.whatsappUrl,
        description: group.description,
      },
    );
    if (isOwnerTeacher) {
      const supervisors = await this.users.find({
        where: [{ role: UserRole.SUPERVISOR }, { role: UserRole.ADMIN }],
      });
      for (const s of supervisors) {
        await this.notify(
          s.id,
          'group_updated',
          'تعديل مجموعة',
          `${actor.firstName} عدّل «${group.name}»`,
          { groupId: group.id },
        );
      }
    }
    return this.enrichGroup(group);
  }

  async listGroups(actor?: User) {
    const rows = await this.groups.find({ order: { createdAt: 'DESC' } });
    let filtered = rows;
    if (actor?.role === UserRole.STUDENT) {
      const gender = this.normalizeUserGender(actor.gender);
      filtered = rows.filter((g) => {
        if (g.status !== GroupStatus.OPEN) return false;
        if (!gender) return true;
        return g.gender === gender;
      });
    } else if (actor?.role === UserRole.TEACHER) {
      filtered = rows.filter(
        (g) =>
          g.teacherId === actor.id ||
          g.status === GroupStatus.OPEN ||
          g.status === GroupStatus.FULL,
      );
    }
    return Promise.all(filtered.map((g) => this.enrichGroup(g)));
  }

  private normalizeUserGender(raw?: string | null): GroupGender | null {
    if (!raw) return null;
    const v = raw.trim().toLowerCase();
    if (['men', 'male', 'm', 'رجال', 'رجل'].includes(v)) return GroupGender.MEN;
    if (['women', 'female', 'f', 'نساء', 'امرأة', 'اناث', 'إناث'].includes(v)) {
      return GroupGender.WOMEN;
    }
    return null;
  }

  async getGroup(id: string) {
    const group = await this.groups.findOne({ where: { id } });
    if (!group) throw new NotFoundException('المجموعة غير موجودة');
    return group;
  }

  async getGroupBrief(actor: User, id: string) {
    const group = await this.enrichGroup(await this.getGroup(id));
    this.assertCanViewGroup(actor, group.teacherId);
    const members = await this.memberships.find({
      where: { groupId: id, leftAt: IsNull() },
    });
    const today = new Date().toISOString().slice(0, 10);
    const allowReportContent = actor.role === UserRole.TEACHER;
    const students = [];
    for (const m of members) {
      const u = m.user;
      const report = await this.dailyReports.findOne({
        where: { studentId: u.id, reportDate: today },
      });
      const dailyReportToday = allowReportContent
        ? report
          ? {
              id: report.id,
              submitted: true,
              memorizedQuota: report.memorizedQuota,
            }
          : { submitted: false }
        : { submitted: !!report };
      students.push({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`,
        phone: u.phone,
        status: u.status,
        dailyReportToday,
      });
    }
    return {
      group,
      students,
      today,
      mode: 'brief',
      whatsappUrl: group.whatsappUrl ?? null,
    };
  }

  async getGroupDetailed(actor: User, id: string) {
    const brief = await this.getGroupBrief(actor, id);
    const members = await this.memberships.find({
      where: { groupId: id, leftAt: IsNull() },
    });
    const allowReportContent = actor.role === UserRole.TEACHER;
    const detailedStudents = [];
    for (const m of members) {
      const sid = m.userId;
      const [notes, infractions, quotas, attendance] = await Promise.all([
        this.notes.find({
          where: { studentId: sid },
          order: { noteDate: 'DESC' },
          take: 20,
        }),
        this.infractions.find({
          where: { studentId: sid },
          order: { createdAt: 'DESC' },
          take: 20,
        }),
        this.quotas.findOne({ where: { studentId: sid } }),
        this.attendance.find({
          where: { studentId: sid, groupId: id },
          order: { sessionDate: 'DESC' },
          take: 12,
        }),
      ]);
      let reports: unknown[] = [];
      let weekly: unknown[] = [];
      if (allowReportContent) {
        const reportRows = await this.dailyReports.find({
          where: { studentId: sid },
          order: { reportDate: 'DESC' },
          take: 14,
        });
        reports = await Promise.all(
          reportRows.map((r) => this.enrichDailyReport(r)),
        );
        const weeklyRows = await this.weeklyReports.find({
          where: { studentId: sid },
          order: { weekStartDate: 'DESC' },
          take: 8,
        });
        weekly = weeklyRows.map((w) => this.formatWeekly(w, 'detailed'));
      }
      detailedStudents.push({
        ...brief.students.find((s) => s.id === sid),
        membership: { joinedAt: m.joinedAt },
        reports,
        notes,
        infractions,
        quota: quotas,
        attendance,
        weeklyReports: weekly,
      });
    }
    return { ...brief, students: detailedStudents, mode: 'detailed' };
  }

  private assertCanViewGroup(actor: User, teacherId: string) {
    if (this.isSupervisor(actor)) return;
    if (actor.role === UserRole.TEACHER && actor.id === teacherId) return;
    throw new ForbiddenException();
  }

  async enrichGroup(group: Group) {
    const teacher =
      group.teacher ||
      (await this.users.findOne({ where: { id: group.teacherId } }));
    const start = group.sessionStartTime || group.weeklySessionTime;
    const end = group.sessionEndTime || null;
    return {
      id: group.id,
      name: group.name,
      teacherId: group.teacherId,
      teacherName: teacher
        ? `${teacher.firstName} ${teacher.lastName}`
        : null,
      teacher: teacher
        ? {
            id: teacher.id,
            firstName: teacher.firstName,
            lastName: teacher.lastName,
            phone: teacher.phone,
          }
        : null,
      gender: group.gender,
      seatCount: group.seatCount,
      currentStudentCount: group.currentStudentCount,
      weeklySessionDay: group.weeklySessionDay,
      weeklySessionTime: start,
      sessionStartTime: start,
      sessionEndTime: end,
      status: group.status,
      whatsappUrl: group.whatsappUrl,
      description: group.description,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    };
  }

  async requestJoin(actor: User, groupId: string) {
    if (actor.role !== UserRole.STUDENT) {
      throw new ForbiddenException('الطلبة فقط يطلبون الانضمام');
    }
    const group = await this.getGroup(groupId);
    if (group.status !== GroupStatus.OPEN) {
      throw new BadRequestException('المجموعة غير مفتوحة للانضمام');
    }
    const studentGender = this.normalizeUserGender(actor.gender);
    if (studentGender && group.gender !== studentGender) {
      throw new BadRequestException('هذه المجموعة لا تطابق جنسك');
    }
    const anyMembership = await this.memberships.findOne({
      where: { userId: actor.id, leftAt: IsNull() },
    });
    if (anyMembership) {
      throw new BadRequestException(
        'أنت منضم لمجموعة بالفعل — لا يمكن طلب مجموعة أخرى',
      );
    }
    const anyPending = await this.joinRequests.findOne({
      where: { studentId: actor.id, status: JoinRequestStatus.PENDING },
    });
    if (anyPending) {
      throw new BadRequestException(
        'لديك طلب انضمام قيد المراجعة — ألغِه أولاً أو انتظر الرد',
      );
    }
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
    const recipients = new Set<string>([group.teacherId]);
    const supervisors = await this.users.find({
      where: [{ role: UserRole.SUPERVISOR }, { role: UserRole.ADMIN }],
    });
    for (const s of supervisors) recipients.add(s.id);
    for (const id of recipients) {
      await this.notify(
        id,
        'join_request',
        'طلب انضمام جديد',
        `${actor.firstName} ${actor.lastName} طلب الانضمام إلى ${group.name}`,
        { joinRequestId: req.id, groupId },
      );
    }
    return req;
  }

  async cancelJoinRequest(actor: User, id: string) {
    if (actor.role !== UserRole.STUDENT) {
      throw new ForbiddenException('الطلبة فقط يلغون طلباتهم');
    }
    const req = await this.joinRequests.findOne({ where: { id } });
    if (!req || req.studentId !== actor.id) {
      throw new NotFoundException('الطلب غير موجود');
    }
    if (req.status !== JoinRequestStatus.PENDING) {
      throw new BadRequestException('لا يمكن إلغاء طلب غير معلّق');
    }
    req.status = JoinRequestStatus.CANCELLED;
    await this.joinRequests.save(req);
    const stillPending = await this.joinRequests.findOne({
      where: { studentId: actor.id, status: JoinRequestStatus.PENDING },
    });
    const membership = await this.memberships.findOne({
      where: { userId: actor.id, leftAt: IsNull() },
    });
    if (!membership && !stillPending) {
      await this.users.update(actor.id, { status: UserStatus.NEW });
    }
    await this.auditLog(actor.id, 'join_request.cancel', 'join_request', id, null, {
      status: req.status,
    });
    return req;
  }

  async listJoinRequests(actor: User) {
    if (actor.role === UserRole.STUDENT) {
      return this.joinRequests.find({
        where: { studentId: actor.id },
        order: { createdAt: 'DESC' },
      });
    }
    this.requireStaff(actor);
    const rows = await this.joinRequests.find({ order: { createdAt: 'DESC' } });
    if (actor.role === UserRole.TEACHER) {
      return rows.filter((r) => r.group?.teacherId === actor.id);
    }
    return rows;
  }

  async reviewJoinRequest(
    actor: User,
    id: string,
    accept: boolean,
    reviewNote?: string,
  ) {
    if (!this.isSupervisor(actor) && actor.role !== UserRole.TEACHER) {
      throw new ForbiddenException('صلاحية المشرف أو معلم المجموعة فقط');
    }
    const req = await this.joinRequests.findOne({ where: { id } });
    if (!req || req.status !== JoinRequestStatus.PENDING) {
      throw new BadRequestException('الطلب غير صالح للمراجعة');
    }
    const group = await this.getGroup(req.groupId);
    if (
      actor.role === UserRole.TEACHER &&
      group.teacherId !== actor.id
    ) {
      throw new ForbiddenException('هذه المجموعة ليست ضمن مجموعاتك');
    }
    const before = { status: req.status };
    if (accept) {
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
      const stillPending = await this.joinRequests.findOne({
        where: { studentId: req.studentId, status: JoinRequestStatus.PENDING },
      });
      const membership = await this.memberships.findOne({
        where: { userId: req.studentId, leftAt: IsNull() },
      });
      if (!membership && !stillPending) {
        await this.users.update(req.studentId, { status: UserStatus.NEW });
      }
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

  async studentHasMembership(actor: User) {
    if (actor.role !== UserRole.STUDENT) return { hasGroup: true };
    const m = await this.memberships.findOne({
      where: { userId: actor.id, leftAt: IsNull() },
    });
    return { hasGroup: !!m, membership: m };
  }

  async listDirectory(actor: User) {
    this.requireSupervisor(actor);
    const [students, teachers, groups] = await Promise.all([
      this.users.find({
        where: { role: UserRole.STUDENT },
        order: { createdAt: 'DESC' },
      }),
      this.users.find({
        where: { role: UserRole.TEACHER },
        order: { createdAt: 'DESC' },
      }),
      this.listGroups(actor),
    ]);
    const strip = (u: User) => {
      const { passwordHash: _, ...safe } = u;
      return safe;
    };
    return {
      students: students.map(strip),
      teachers: teachers.map(strip),
      groups,
    };
  }

  private formatWeekly(
    w: WeeklyReport,
    mode: 'brief' | 'detailed' = 'brief',
  ) {
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
      missedSingleSitting: (summary.missedSingleSitting as number | undefined) ?? 0,
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
      memorizationSurahNumber?: number;
      memorizationSurahName?: string;
      memorizationAyahFrom?: number;
      memorizationAyahTo?: number;
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
    const range = this.validateQalunMemorizationRange(input);
    const report = await this.dailyReports.save(
      this.dailyReports.create({
        student: actor,
        studentId: actor.id,
        reportDate: input.reportDate,
        memorizedQuota: input.memorizedQuota,
        memorizationFrom: input.memorizationFrom ?? null,
        memorizationTo: input.memorizationTo ?? null,
        memorizationSurahNumber: range?.surahNumber ?? null,
        memorizationSurahName: range?.surahName ?? null,
        memorizationAyahFrom: range?.ayahFrom ?? null,
        memorizationAyahTo: range?.ayahTo ?? null,
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
    await this.notifyTeacherAboutStudent(
      actor.id,
      'daily_report_submitted',
      'تقرير يومي جديد',
      `${actor.firstName} ${actor.lastName} أرسل تقرير ${input.reportDate}`,
      {
        reportId: report.id,
        reportDate: input.reportDate,
        studentId: actor.id,
        studentName: `${actor.firstName} ${actor.lastName}`,
      },
    );
    return this.enrichDailyReport(report);
  }

  private qalunSurahCounts: Map<number, { nameAr: string; ayahCount: number }> | null =
    null;

  private loadQalunSurahCounts() {
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

  private validateQalunMemorizationRange(input: {
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
  async listDailyReports(
    actor: User,
    filters: {
      studentId?: string;
      reportDate?: string;
      groupId?: string;
      from?: string;
      to?: string;
    },
  ) {
    let rows: DailyReport[];
    const applyRange = (qb: ReturnType<typeof this.dailyReports.createQueryBuilder>) => {
      if (filters.reportDate) {
        qb.andWhere('r.reportDate = :d', { d: filters.reportDate });
      } else {
        if (filters.from) qb.andWhere('r.reportDate >= :from', { from: filters.from });
        if (filters.to) qb.andWhere('r.reportDate <= :to', { to: filters.to });
      }
      return qb;
    };
    if (actor.role === UserRole.STUDENT) {
      const qb = this.dailyReports
        .createQueryBuilder('r')
        .where('r.studentId = :sid', { sid: actor.id });
      applyRange(qb);
      rows = await qb.orderBy('r.reportDate', 'DESC').take(400).getMany();
      return Promise.all(rows.map((r) => this.enrichDailyReport(r)));
    }
    if (this.isSupervisor(actor)) {
      throw new ForbiddenException(
        'التقارير اليومية متاحة للمعلم فقط — المشرف لا يطّلع على محتوى التقارير',
      );
    }
    this.requireTeacher(actor);
    if (filters.studentId) {
      await this.assertTeacherOwnsStudent(actor, filters.studentId);
      const qb = this.dailyReports
        .createQueryBuilder('r')
        .leftJoinAndSelect('r.student', 'student')
        .where('r.studentId = :sid', { sid: filters.studentId });
      applyRange(qb);
      rows = await qb.orderBy('r.reportDate', 'DESC').take(400).getMany();
      return Promise.all(rows.map((r) => this.enrichDailyReport(r)));
    }
    const myGroups = await this.groups.find({
      where: { teacherId: actor.id },
    });
    const ids = myGroups.map((g) => g.id);
    let groupId = filters.groupId;
    if (groupId && !ids.includes(groupId)) {
      throw new ForbiddenException();
    }
    if (!groupId && ids.length === 1) groupId = ids[0];
    if (!groupId) {
      if (!ids.length) return [];
      const memberIds = (
        await this.memberships.find({
          where: ids.map((id) => ({ groupId: id, leftAt: IsNull() })),
        })
      ).map((m) => m.userId);
      if (!memberIds.length) return [];
      const qb = this.dailyReports
        .createQueryBuilder('r')
        .leftJoinAndSelect('r.student', 'student')
        .where('r.studentId IN (:...memberIds)', { memberIds });
      applyRange(qb);
      rows = await qb
        .orderBy('r.reportDate', 'DESC')
        .addOrderBy('r.submittedAt', 'DESC')
        .take(400)
        .getMany();
      return Promise.all(rows.map((r) => this.enrichDailyReport(r)));
    }
    const members = await this.memberships.find({
      where: { groupId, leftAt: IsNull() },
    });
    const memberIds = members.map((m) => m.userId);
    if (!memberIds.length) return [];
    const qb = this.dailyReports
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.student', 'student')
      .where('r.studentId IN (:...memberIds)', { memberIds });
    applyRange(qb);
    rows = await qb
      .orderBy('r.reportDate', 'DESC')
      .addOrderBy('r.submittedAt', 'DESC')
      .take(400)
      .getMany();
    return Promise.all(rows.map((r) => this.enrichDailyReport(r)));
  }

  async getDailyReport(actor: User, id: string) {
    const report = await this.dailyReports.findOne({ where: { id } });
    if (!report) throw new NotFoundException('التقرير غير موجود');
    if (actor.role === UserRole.STUDENT) {
      if (report.studentId !== actor.id) throw new ForbiddenException();
    } else if (this.isSupervisor(actor)) {
      throw new ForbiddenException(
        'التقارير اليومية متاحة للمعلم فقط — المشرف لا يطّلع على محتوى التقارير',
      );
    } else {
      this.requireTeacher(actor);
      await this.assertTeacherOwnsStudent(actor, report.studentId);
    }
    return this.enrichDailyReport(report);
  }

  private async assertTeacherOwnsStudent(actor: User, studentId: string) {
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

  private async enrichDailyReport(report: DailyReport) {
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

  async listAttendance(
    actor: User,
    groupId?: string,
    sessionDate?: string,
    from?: string,
    to?: string,
  ) {
    this.requireStaff(actor);
    let allowedGroupIds: string[] | null = null;
    if (actor.role === UserRole.TEACHER) {
      const myGroups = await this.groups.find({ where: { teacherId: actor.id } });
      allowedGroupIds = myGroups.map((g) => g.id);
      if (!allowedGroupIds.length) return [];
      if (groupId && !allowedGroupIds.includes(groupId)) {
        throw new ForbiddenException();
      }
    }
    const qb = this.attendance
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.student', 'student')
      .leftJoinAndSelect('a.group', 'group');
    if (groupId) {
      qb.andWhere('a.groupId = :groupId', { groupId });
    } else if (allowedGroupIds) {
      qb.andWhere('a.groupId IN (:...gids)', { gids: allowedGroupIds });
    }
    if (sessionDate) {
      qb.andWhere('a.sessionDate = :sessionDate', { sessionDate });
    } else {
      if (from) qb.andWhere('a.sessionDate >= :from', { from });
      if (to) qb.andWhere('a.sessionDate <= :to', { to });
    }
    const rows = await qb
      .orderBy('a.sessionDate', 'DESC')
      .addOrderBy('a.createdAt', 'DESC')
      .take(500)
      .getMany();
    return rows.map((a) => ({
      id: a.id,
      studentId: a.studentId,
      studentName: a.student
        ? `${a.student.firstName} ${a.student.lastName}`
        : null,
      groupId: a.groupId,
      groupName: a.group?.name ?? null,
      sessionDate: a.sessionDate,
      status: a.status,
      arrivedLate: a.arrivedLate,
      leftEarly: a.leftEarly,
      note: a.note,
      recordedById: a.recordedById,
      createdAt: a.createdAt,
    }));
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
    actor: User | null,
    studentId: string,
    weekStartDate: string,
    weekEndDate: string,
    opts?: { silent?: boolean; sessionDate?: string; groupId?: string },
  ) {
    if (actor) {
      if (this.isSupervisor(actor)) {
        throw new ForbiddenException(
          'التقارير الأسبوعية للمعلم فقط — المشرف لا يولّد أو يطّلع على محتوى التقارير',
        );
      }
      this.requireTeacher(actor);
      await this.assertTeacherOwnsStudent(actor, studentId);
    }
    const membership = await this.memberships.findOne({
      where: { userId: studentId, leftAt: IsNull() },
    });
    const groupId = opts?.groupId ?? membership?.groupId ?? null;
    const dailies = await this.dailyReports
      .createQueryBuilder('r')
      .where('r.studentId = :studentId', { studentId })
      .andWhere('r.reportDate >= :start', { start: weekStartDate })
      .andWhere('r.reportDate <= :end', { end: weekEndDate })
      .getMany();
    const att = groupId
      ? await this.attendance
          .createQueryBuilder('a')
          .where('a.studentId = :studentId', { studentId })
          .andWhere('a.groupId = :groupId', { groupId })
          .andWhere('a.sessionDate >= :start', { start: weekStartDate })
          .andWhere('a.sessionDate <= :end', { end: weekEndDate })
          .getMany()
      : [];
    const byDate = new Map(dailies.map((d) => [d.reportDate, d]));
    const days = this.eachDateInclusive(weekStartDate, weekEndDate);
    let missedDailyReports = 0;
    let missedQuota = 0;
    let missedFiftyReps = 0;
    let missedSingleSitting = 0;
    let missedReview = 0;
    for (const day of days) {
      const r = byDate.get(day);
      if (!r) {
        missedDailyReports++;
        missedQuota++;
        missedFiftyReps++;
        missedSingleSitting++;
        missedReview++;
        continue;
      }
      if (!r.memorizedQuota) missedQuota++;
      if (!r.completedFiftyRepetitions) missedFiftyReps++;
      if (!r.repeatedInOneSitting) missedSingleSitting++;
      if (!r.reviewPortion) missedReview++;
    }
    const sessionDate = opts?.sessionDate;
    const sessionRow = sessionDate
      ? att.find((a) => a.sessionDate === sessionDate)
      : att.find((a) => a.status === AttendanceStatus.PRESENT) ?? att[0];
    const attendedMajlis = sessionRow
      ? sessionRow.status === AttendanceStatus.PRESENT
      : att.some((a) => a.status === AttendanceStatus.PRESENT);
    let existing = await this.weeklyReports.findOne({
      where: { studentId, weekStartDate },
    });
    const wasNew = !existing;
    const payload = {
      studentId,
      groupId,
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
        dailyCount: dailies.length,
        sessionDate: sessionDate ?? sessionRow?.sessionDate ?? null,
        attendedMajlis,
        attendedMajlisLabel: attendedMajlis ? 'نعم' : 'لا',
        missedDailyReports,
        missedQuota,
        missedFiftyReps,
        missedSingleSitting,
        missedReview,
        weekDayCount: days.length,
      },
      generatedAt: new Date(),
    };
    if (existing) {
      Object.assign(existing, payload);
    } else {
      existing = this.weeklyReports.create(payload);
    }
    const saved = await this.weeklyReports.save(existing);
    await this.dailyReports
      .createQueryBuilder()
      .delete()
      .where('studentId = :studentId', { studentId })
      .andWhere('reportDate >= :start', { start: weekStartDate })
      .andWhere('reportDate <= :end', { end: weekEndDate })
      .execute();
    if (!opts?.silent && wasNew) {
      await this.notify(
        studentId,
        'weekly_report',
        'تقرير أسبوعي جاهز للتأكيد',
        `الأسبوع ${weekStartDate} — ${weekEndDate}`,
        { weeklyReportId: saved.id },
      );
    }
    return (
      (await this.weeklyReports.findOne({ where: { id: saved.id } })) ?? saved
    );
  }

  /**
   * Teacher saves weekly مجلس attendance for a group, then weekly reports
   * are generated/updated for each student (PDF «التقرير الأسبوعي» fields).
   */
  async saveWeeklyAttendance(
    actor: User,
    input: {
      groupId: string;
      sessionDate: string;
      entries: Array<{
        studentId: string;
        status: AttendanceStatus;
        arrivedLate?: boolean;
        leftEarly?: boolean;
        note?: string;
      }>;
    },
  ) {
    if (this.isSupervisor(actor)) {
      throw new ForbiddenException(
        'حفظ حضور المجلس الأسبوعي وتوليد التقارير للمعلم فقط',
      );
    }
    this.requireTeacher(actor);
    const group = await this.getGroup(input.groupId);
    if (group.teacherId !== actor.id) {
      throw new ForbiddenException('هذه المجموعة ليست لك');
    }
    if (!input.entries?.length) {
      throw new BadRequestException('لا سجلات حضور');
    }
    const attendanceRows = [];
    for (const entry of input.entries) {
      const saved = await this.recordAttendance(actor, {
        studentId: entry.studentId,
        groupId: input.groupId,
        sessionDate: input.sessionDate,
        status: entry.status,
        arrivedLate: entry.arrivedLate,
        leftEarly: entry.leftEarly,
        note: entry.note,
      });
      attendanceRows.push(saved);
    }
    const { weekStart, weekEnd } = this.weekBoundsForDate(input.sessionDate);
    const reports = [];
    for (const entry of input.entries) {
      const saved = await this.generateWeeklyReport(
        actor,
        entry.studentId,
        weekStart,
        weekEnd,
        {
          silent: true,
          sessionDate: input.sessionDate,
          groupId: input.groupId,
        },
      );
      const full =
        (await this.weeklyReports.findOne({ where: { id: saved.id } })) ?? saved;
      reports.push(full);
      await this.notify(
        entry.studentId,
        'weekly_report',
        'تقريرك الأسبوعي جاهز',
        `بعد مجلس التسميع · ${weekStart} — ${weekEnd}`,
        { weeklyReportId: saved.id, groupId: input.groupId },
      );
    }
    await this.notify(
      actor.id,
      'weekly_report_staff',
      'تقارير أسبوعية بعد الحضور',
      `تم توليد/تحديث ${reports.length} تقريراً لأسبوع ${weekStart}`,
      {
        groupId: input.groupId,
        sessionDate: input.sessionDate,
        weekStart,
        weekEnd,
        count: reports.length,
      },
    );
    await this.auditLog(
      actor.id,
      'attendance.weekly_save',
      'group',
      input.groupId,
      null,
      {
        sessionDate: input.sessionDate,
        weekStart,
        weekEnd,
        attendanceCount: attendanceRows.length,
        weeklyReportCount: reports.length,
      },
    );
    return {
      sessionDate: input.sessionDate,
      weekStart,
      weekEnd,
      attendance: attendanceRows,
      weeklyReports: reports.map((w) => this.formatWeekly(w, 'detailed')),
      generated: reports.length,
    };
  }

  /**
   * Fallback only: previous Sat–Fri week, and only for students who already
   * have weekly attendance saved that week but still lack a weekly report.
   */
  async autoGenerateWeeklyReports(timezone = 'Africa/Algiers') {
    const { weekStart, weekEnd } = this.previousWeekBounds(timezone);
    const members = await this.memberships.find({ where: { leftAt: IsNull() } });
    const studentIds = [...new Set(members.map((m) => m.userId))];
    let created = 0;
    let skippedNoAttendance = 0;
    for (const studentId of studentIds) {
      const existing = await this.weeklyReports.findOne({
        where: { studentId, weekStartDate: weekStart },
      });
      if (existing) continue;
      const membership = members.find((m) => m.userId === studentId);
      if (!membership?.groupId) {
        skippedNoAttendance++;
        continue;
      }
      const hasAttendance = await this.attendance
        .createQueryBuilder('a')
        .where('a.studentId = :studentId', { studentId })
        .andWhere('a.groupId = :groupId', { groupId: membership.groupId })
        .andWhere('a.sessionDate >= :start', { start: weekStart })
        .andWhere('a.sessionDate <= :end', { end: weekEnd })
        .getCount();
      if (!hasAttendance) {
        skippedNoAttendance++;
        continue;
      }
      const saved = await this.generateWeeklyReport(
        null,
        studentId,
        weekStart,
        weekEnd,
        { silent: true, groupId: membership.groupId },
      );
      created++;
      await this.notify(
        studentId,
        'weekly_report',
        'تقريرك الأسبوعي جاهز',
        `الأسبوع ${weekStart} — ${weekEnd}`,
        { weeklyReportId: saved.id },
      );
      const group = await this.groups.findOne({
        where: { id: membership.groupId },
      });
      if (group?.teacherId) {
        await this.notify(
          group.teacherId,
          'weekly_report_staff',
          'تقرير أسبوعي (احتياطي)',
          `تقرير أسبوعي للطالب جاهز (${weekStart})`,
          { weeklyReportId: saved.id, studentId },
        );
      }
    }
    return { weekStart, weekEnd, created, skippedNoAttendance };
  }

  /** Sat–Fri week containing `isoDate` (Africa/Algiers program week). */
  private weekBoundsForDate(isoDate: string) {
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

  private eachDateInclusive(start: string, end: string): string[] {
    const out: string[] = [];
    const d = new Date(`${start}T12:00:00Z`);
    const last = new Date(`${end}T12:00:00Z`);
    while (d.getTime() <= last.getTime()) {
      out.push(d.toISOString().slice(0, 10));
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return out;
  }

  private previousWeekBounds(timezone: string) {
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
    const today = new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00Z`);
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

  async confirmWeeklyReport(actor: User, id: string) {
    const report = await this.weeklyReports.findOne({ where: { id } });
    if (!report) throw new NotFoundException();
    if (actor.role === UserRole.STUDENT && report.studentId !== actor.id) {
      throw new ForbiddenException();
    }
    if (actor.role === UserRole.TEACHER) {
      await this.assertTeacherOwnsStudent(actor, report.studentId);
    } else if (actor.role !== UserRole.STUDENT) {
      throw new ForbiddenException(
        'التقارير الأسبوعية متاحة للمعلم والطالب فقط',
      );
    }
    report.studentConfirmedAt = new Date();
    return this.weeklyReports.save(report);
  }

  async listWeeklyReports(
    actor: User,
    studentId?: string,
    mode: 'brief' | 'detailed' = 'brief',
  ) {
    if (this.isSupervisor(actor)) {
      throw new ForbiddenException(
        'التقارير الأسبوعية متاحة للمعلم فقط — المشرف لا يطّلع عليها',
      );
    }
    let rows: WeeklyReport[];
    if (actor.role === UserRole.STUDENT) {
      rows = await this.weeklyReports.find({
        where: { studentId: actor.id },
        order: { weekStartDate: 'DESC' },
      });
    } else {
      this.requireTeacher(actor);
      if (!studentId) {
        const groups = await this.groups.find({ where: { teacherId: actor.id } });
        const gids = groups.map((g) => g.id);
        if (!gids.length) return [];
        rows = await this.weeklyReports
          .createQueryBuilder('w')
          .leftJoinAndSelect('w.student', 'student')
          .leftJoinAndSelect('w.group', 'group')
          .where('w.groupId IN (:...gids)', { gids })
          .orderBy('w.weekStartDate', 'DESC')
          .take(200)
          .getMany();
      } else {
        await this.assertTeacherOwnsStudent(actor, studentId);
        rows = await this.weeklyReports.find({
          where: { studentId },
          order: { weekStartDate: 'DESC' },
          take: 200,
        });
      }
    }
    return rows.map((w) => this.formatWeekly(w, mode));
  }

  async getWeeklyReport(
    actor: User,
    id: string,
    mode: 'brief' | 'detailed' = 'detailed',
  ) {
    if (this.isSupervisor(actor)) {
      throw new ForbiddenException(
        'التقارير الأسبوعية متاحة للمعلم فقط — المشرف لا يطّلع عليها',
      );
    }
    const report = await this.weeklyReports.findOne({ where: { id } });
    if (!report) throw new NotFoundException();
    if (actor.role === UserRole.STUDENT && report.studentId !== actor.id) {
      throw new ForbiddenException();
    }
    if (actor.role === UserRole.TEACHER) {
      await this.assertTeacherOwnsStudent(actor, report.studentId);
    } else if (actor.role !== UserRole.STUDENT) {
      throw new ForbiddenException();
    }
    return this.formatWeekly(report, mode);
  }

  /** Calendar quarters (Africa/Algiers): Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec. */
  private trimesterBoundsForDate(isoDate: string) {
    const d = new Date(`${isoDate}T12:00:00Z`);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth(); // 0–11
    const q = Math.floor(month / 3);
    const startMonth = q * 3;
    const start = new Date(Date.UTC(year, startMonth, 1, 12));
    const end = new Date(Date.UTC(year, startMonth + 3, 0, 12));
    const iso = (x: Date) => x.toISOString().slice(0, 10);
    return {
      periodStart: iso(start),
      periodEnd: iso(end),
      quarter: q + 1,
      year,
    };
  }

  private previousTrimesterBounds(timezone = 'Africa/Algiers') {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = Object.fromEntries(
      fmt.formatToParts(new Date()).map((p) => [p.type, p.value]),
    );
    const today = `${parts.year}-${parts.month}-${parts.day}`;
    const current = this.trimesterBoundsForDate(today);
    const curStart = new Date(`${current.periodStart}T12:00:00Z`);
    curStart.setUTCDate(curStart.getUTCDate() - 1);
    return this.trimesterBoundsForDate(curStart.toISOString().slice(0, 10));
  }

  private formatTrimestrial(t: TrimestrialReport) {
    const student = t.student;
    return {
      id: t.id,
      studentId: t.studentId,
      studentName: student
        ? `${student.firstName} ${student.lastName}`
        : null,
      groupId: t.groupId,
      groupName: t.group?.name ?? null,
      periodStartDate: t.periodStartDate,
      periodEndDate: t.periodEndDate,
      weeksCount: t.weeksCount,
      dailyReportsSubmitted: t.dailyReportsSubmitted,
      quotaDaysMet: t.quotaDaysMet,
      fiftyRepsDaysMet: t.fiftyRepsDaysMet,
      presentSessions: t.presentSessions,
      excusedAbsences: t.excusedAbsences,
      unexcusedAbsences: t.unexcusedAbsences,
      missedDailyReports: t.missedDailyReports,
      missedQuota: t.missedQuota,
      missedFiftyReps: t.missedFiftyReps,
      missedSingleSitting: t.missedSingleSitting,
      missedReview: t.missedReview,
      weeksAttendedMajlis: t.weeksAttendedMajlis,
      summaryJson: t.summaryJson,
      generatedAt: t.generatedAt,
    };
  }

  /**
   * Close a trimester: aggregate weeklies → trimestrial per student/group,
   * then delete those weekly reports. Daily reports for that span are already
   * gone after each weekly generation.
   */
  async generateTrimestrialReports(
    actor: User | null,
    periodStartDate?: string,
    periodEndDate?: string,
  ) {
    if (actor) {
      if (
        actor.role !== UserRole.TEACHER &&
        actor.role !== UserRole.SUPERVISOR &&
        actor.role !== UserRole.ADMIN
      ) {
        throw new ForbiddenException();
      }
    }
    const bounds =
      periodStartDate && periodEndDate
        ? { periodStart: periodStartDate, periodEnd: periodEndDate }
        : this.previousTrimesterBounds();
    const weeklies = await this.weeklyReports
      .createQueryBuilder('w')
      .leftJoinAndSelect('w.student', 'student')
      .leftJoinAndSelect('w.group', 'group')
      .where('w.weekStartDate >= :start', { start: bounds.periodStart })
      .andWhere('w.weekEndDate <= :end', { end: bounds.periodEnd })
      .getMany();
    if (!weeklies.length) {
      return {
        periodStart: bounds.periodStart,
        periodEnd: bounds.periodEnd,
        generated: 0,
        deletedWeeklies: 0,
        reports: [],
      };
    }
    const byKey = new Map<string, WeeklyReport[]>();
    for (const w of weeklies) {
      const key = `${w.studentId}::${w.groupId ?? ''}`;
      const list = byKey.get(key) ?? [];
      list.push(w);
      byKey.set(key, list);
    }
    const created: TrimestrialReport[] = [];
    for (const [, rows] of byKey) {
      const first = rows[0];
      let missedDailyReports = 0;
      let missedQuota = 0;
      let missedFiftyReps = 0;
      let missedSingleSitting = 0;
      let missedReview = 0;
      let weeksAttendedMajlis = 0;
      const weekSnapshots: Record<string, unknown>[] = [];
      for (const w of rows) {
        const formatted = this.formatWeekly(w, 'detailed');
        missedDailyReports += Number(formatted.missedDailyReports ?? 0);
        missedQuota += Number(formatted.missedQuota ?? 0);
        missedFiftyReps += Number(formatted.missedFiftyReps ?? 0);
        missedSingleSitting += Number(formatted.missedSingleSitting ?? 0);
        missedReview += Number(formatted.missedReview ?? 0);
        if (formatted.attendedMajlis) weeksAttendedMajlis++;
        weekSnapshots.push({
          weeklyReportId: w.id,
          weekStartDate: w.weekStartDate,
          weekEndDate: w.weekEndDate,
          attendedMajlis: formatted.attendedMajlis,
          missedDailyReports: formatted.missedDailyReports,
          missedQuota: formatted.missedQuota,
          missedFiftyReps: formatted.missedFiftyReps,
          missedSingleSitting: formatted.missedSingleSitting,
          missedReview: formatted.missedReview,
          dailyReportsSubmitted: w.dailyReportsSubmitted,
          quotaDaysMet: w.quotaDaysMet,
          fiftyRepsDaysMet: w.fiftyRepsDaysMet,
          presentSessions: w.presentSessions,
          excusedAbsences: w.excusedAbsences,
          unexcusedAbsences: w.unexcusedAbsences,
        });
      }
      let existing = await this.trimestrialReports.findOne({
        where: {
          studentId: first.studentId,
          periodStartDate: bounds.periodStart,
          ...(first.groupId
            ? { groupId: first.groupId }
            : { groupId: IsNull() }),
        },
      });
      const payload = {
        studentId: first.studentId,
        groupId: first.groupId,
        periodStartDate: bounds.periodStart,
        periodEndDate: bounds.periodEnd,
        weeksCount: rows.length,
        dailyReportsSubmitted: rows.reduce(
          (s, w) => s + w.dailyReportsSubmitted,
          0,
        ),
        quotaDaysMet: rows.reduce((s, w) => s + w.quotaDaysMet, 0),
        fiftyRepsDaysMet: rows.reduce((s, w) => s + w.fiftyRepsDaysMet, 0),
        presentSessions: rows.reduce((s, w) => s + w.presentSessions, 0),
        excusedAbsences: rows.reduce((s, w) => s + w.excusedAbsences, 0),
        unexcusedAbsences: rows.reduce((s, w) => s + w.unexcusedAbsences, 0),
        missedDailyReports,
        missedQuota,
        missedFiftyReps,
        missedSingleSitting,
        missedReview,
        weeksAttendedMajlis,
        summaryJson: {
          weeklyReportIds: rows.map((w) => w.id),
          weeks: weekSnapshots,
        },
        generatedAt: new Date(),
      };
      if (existing) {
        Object.assign(existing, payload);
      } else {
        existing = this.trimestrialReports.create(payload);
      }
      created.push(await this.trimestrialReports.save(existing));
    }
    const weeklyIds = weeklies.map((w) => w.id);
    await this.weeklyReports.delete({ id: In(weeklyIds) });

    const groupIds = [
      ...new Set(created.map((c) => c.groupId).filter(Boolean) as string[]),
    ];
    for (const gid of groupIds) {
      const group = await this.groups.findOne({ where: { id: gid } });
      const count = created.filter((c) => c.groupId === gid).length;
      if (group?.teacherId) {
        await this.notify(
          group.teacherId,
          'trimestrial_report_staff',
          'تقارير فصلية جاهزة',
          `تم توليد ${count} تقريراً فصلياً · ${bounds.periodStart} — ${bounds.periodEnd}`,
          {
            groupId: gid,
            periodStart: bounds.periodStart,
            periodEnd: bounds.periodEnd,
            count,
          },
        );
      }
    }
    const supervisors = await this.users.find({
      where: { role: UserRole.SUPERVISOR },
    });
    for (const s of supervisors) {
      await this.notify(
        s.id,
        'trimestrial_report_staff',
        'تقارير فصلية جاهزة',
        `تم توليد ${created.length} تقريراً فصلياً للفترة ${bounds.periodStart} — ${bounds.periodEnd}`,
        {
          periodStart: bounds.periodStart,
          periodEnd: bounds.periodEnd,
          count: created.length,
        },
      );
    }
    if (actor) {
      await this.auditLog(
        actor.id,
        'trimestrial.generate',
        'trimestrial_report',
        null,
        null,
        {
          periodStart: bounds.periodStart,
          periodEnd: bounds.periodEnd,
          generated: created.length,
          deletedWeeklies: weeklyIds.length,
        },
      );
    }
    const full = await this.trimestrialReports.find({
      where: { id: In(created.map((c) => c.id)) },
    });
    return {
      periodStart: bounds.periodStart,
      periodEnd: bounds.periodEnd,
      generated: created.length,
      deletedWeeklies: weeklyIds.length,
      reports: full.map((t) => this.formatTrimestrial(t)),
    };
  }

  async autoGenerateTrimestrialReports(timezone = 'Africa/Algiers') {
    const bounds = this.previousTrimesterBounds(timezone);
    return this.generateTrimestrialReports(
      null,
      bounds.periodStart,
      bounds.periodEnd,
    );
  }

  async listTrimestrialReports(actor: User, groupId?: string) {
    if (
      actor.role !== UserRole.TEACHER &&
      !this.isSupervisor(actor) &&
      actor.role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException(
        'التقارير الفصلية متاحة للمعلم والمشرف',
      );
    }
    let rows: TrimestrialReport[];
    if (actor.role === UserRole.TEACHER) {
      const groups = await this.groups.find({ where: { teacherId: actor.id } });
      const gids = groups.map((g) => g.id);
      if (!gids.length) return { groups: [] };
      if (groupId && !gids.includes(groupId)) throw new ForbiddenException();
      const filterIds = groupId ? [groupId] : gids;
      rows = await this.trimestrialReports
        .createQueryBuilder('t')
        .leftJoinAndSelect('t.student', 'student')
        .leftJoinAndSelect('t.group', 'group')
        .where('t.groupId IN (:...gids)', { gids: filterIds })
        .orderBy('t.periodStartDate', 'DESC')
        .addOrderBy('group.name', 'ASC')
        .addOrderBy('student.firstName', 'ASC')
        .take(500)
        .getMany();
    } else {
      const qb = this.trimestrialReports
        .createQueryBuilder('t')
        .leftJoinAndSelect('t.student', 'student')
        .leftJoinAndSelect('t.group', 'group');
      if (groupId) qb.where('t.groupId = :groupId', { groupId });
      rows = await qb
        .orderBy('t.periodStartDate', 'DESC')
        .addOrderBy('group.name', 'ASC')
        .addOrderBy('student.firstName', 'ASC')
        .take(500)
        .getMany();
    }
    const byGroup = new Map<
      string,
      {
        groupId: string | null;
        groupName: string | null;
        reports: ReturnType<DomainService['formatTrimestrial']>[];
      }
    >();
    for (const t of rows) {
      const key = t.groupId ?? '_none';
      const bucket = byGroup.get(key) ?? {
        groupId: t.groupId,
        groupName: t.group?.name ?? null,
        reports: [],
      };
      bucket.reports.push(this.formatTrimestrial(t));
      byGroup.set(key, bucket);
    }
    return {
      groups: [...byGroup.values()],
      flat: rows.map((t) => this.formatTrimestrial(t)),
    };
  }

  async getTrimestrialReport(actor: User, id: string) {
    if (
      actor.role !== UserRole.TEACHER &&
      !this.isSupervisor(actor) &&
      actor.role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException();
    }
    const report = await this.trimestrialReports.findOne({ where: { id } });
    if (!report) throw new NotFoundException();
    if (actor.role === UserRole.TEACHER) {
      await this.assertTeacherOwnsStudent(actor, report.studentId);
    }
    return this.formatTrimestrial(report);
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

  async markNotificationsRead(actor: User, ids?: string[]) {
    const qb = this.notifications
      .createQueryBuilder()
      .update()
      .set({ readAt: new Date() })
      .where('recipientId = :rid', { rid: actor.id })
      .andWhere('readAt IS NULL');
    if (ids?.length) {
      qb.andWhere('id IN (:...ids)', { ids });
    }
    const result = await qb.execute();
    return { marked: result.affected ?? 0 };
  }

  async clearNotifications(actor: User) {
    const result = await this.notifications.delete({ recipientId: actor.id });
    return { cleared: result.affected ?? 0 };
  }

  async deleteNotification(actor: User, id: string) {
    const result = await this.notifications.delete({
      id,
      recipientId: actor.id,
    });
    if (!result.affected) {
      throw new NotFoundException('الإشعار غير موجود');
    }
    return { deleted: 1 };
  }

  private async unreadNotificationCount(userId: string) {
    return this.notifications.count({
      where: { recipientId: userId, readAt: IsNull() },
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
    let missingTotal = 0;
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
      const todayReportsRaw = memberIds.length
        ? await this.dailyReports
            .createQueryBuilder('r')
            .leftJoinAndSelect('r.student', 'student')
            .where('r.studentId IN (:...memberIds)', { memberIds })
            .andWhere('r.reportDate = :today', { today })
            .orderBy('r.submittedAt', 'DESC')
            .getMany()
        : [];
      const todayReports = await Promise.all(
        todayReportsRaw.map((r) => this.enrichDailyReport(r)),
      );
      const openInfractions = memberIds.length
        ? await this.infractions
            .createQueryBuilder('i')
            .where('i.studentId IN (:...memberIds)', { memberIds })
            .andWhere('i.resolved = false')
            .getCount()
        : 0;
      const missingToday = Math.max(0, members.length - submittedToday);
      missingTotal += missingToday;
      result.push({
        group: g,
        studentCount: members.length,
        submittedToday,
        missingToday,
        openInfractions,
        todayReports,
        students: members.map((m) => ({
          id: m.user.id,
          name: `${m.user.firstName} ${m.user.lastName}`,
          phone: m.user.phone,
          status: m.user.status,
        })),
      });
    }
    const groupIds = groups.map((g) => g.id);
    const pendingJoins = groupIds.length
      ? await this.joinRequests
          .createQueryBuilder('j')
          .where('j.groupId IN (:...groupIds)', { groupIds })
          .andWhere('j.status = :st', { st: JoinRequestStatus.PENDING })
          .getCount()
      : 0;
    const unreadNotifications = await this.unreadNotificationCount(actor.id);
    let submittedTotal = 0;
    for (const row of result) {
      submittedTotal += (row.submittedToday as number) ?? 0;
    }
    return {
      today,
      groups: result,
      badges: {
        pendingJoins,
        missingTodayReports: missingTotal,
        todaySubmittedReports: submittedTotal,
        unreadNotifications,
      },
    };
  }

  async supervisorDashboard(actor: User) {
    this.requireSupervisor(actor);
    const today = new Date().toISOString().slice(0, 10);
    const [
      students,
      teachers,
      groups,
      pendingJoins,
      pendingAccounts,
      pendingGroupApprovals,
      activeStudents,
      openInfractions,
      unreadNotifications,
    ] = await Promise.all([
      this.users.count({ where: { role: UserRole.STUDENT } }),
      this.users.count({ where: { role: UserRole.TEACHER } }),
      this.groups.count(),
      this.joinRequests.count({ where: { status: JoinRequestStatus.PENDING } }),
      this.users.count({ where: { status: UserStatus.PENDING_APPROVAL } }),
      this.groups.count({ where: { status: GroupStatus.PENDING_APPROVAL } }),
      this.users.count({
        where: { role: UserRole.STUDENT, status: UserStatus.ACTIVE },
      }),
      this.infractions.count({ where: { resolved: false } }),
      this.unreadNotificationCount(actor.id),
    ]);
    return {
      today,
      students,
      teachers,
      groups,
      pendingJoins,
      pendingAccounts,
      pendingGroupApprovals,
      activeStudents,
      openInfractions,
      badges: {
        pendingJoins,
        pendingAccounts,
        pendingGroupApprovals,
        unreadNotifications,
      },
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

  private requireTeacher(actor: User) {
    if (actor.role !== UserRole.TEACHER) {
      throw new ForbiddenException('صلاحية المعلم فقط');
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
