import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { IsNull } from 'typeorm';
import {
  GroupGender,
  GroupStatus,
  JoinRequestStatus,
  UserRole,
  UserStatus,
} from '../common/enums';
import { User } from '../entities/user.entity';
import { Group } from '../entities/group.entity';
import { DomainContext } from './domain-context';

@Injectable()
export class GroupsService {
  constructor(private readonly ctx: DomainContext) {}

  listUsers(actor: User) {
    this.ctx.requireStaff(actor);
    return this.ctx.users.find({ order: { createdAt: 'DESC' } });
  }

  async listPendingAccounts(actor: User) {
    this.ctx.requireSupervisor(actor);
    const rows = await this.ctx.users.find({
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
    this.ctx.requireSupervisor(actor);
    const user = await this.ctx.users.findOne({ where: { id: userId } });
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
      await this.ctx.users.save(user);
      await this.ctx.notify(
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
      await this.ctx.users.save(user);
      const reason = user.accountReviewNote
        ? ` السبب: ${user.accountReviewNote}`
        : '';
      await this.ctx.notify(
        user.id,
        'account_rejected',
        'تم رفض تفعيل الحساب',
        `رفض المشرف تفعيل حسابك.${reason}`,
        { userId: user.id, role: user.role },
      );
    }
    await this.ctx.auditLog(
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
    const isSupervisor = this.ctx.isSupervisor(actor);
    const isTeacher = actor.role === UserRole.TEACHER;
    if (!isSupervisor && !isTeacher) {
      throw new ForbiddenException('صلاحية إنشاء المجموعات غير متاحة');
    }
    let teacherId = input.teacherId;
    if (isTeacher) {
      teacherId = actor.id;
    }
    if (!teacherId) throw new BadRequestException('المعلم مطلوب');
    const teacher = await this.ctx.users.findOne({ where: { id: teacherId } });
    if (!teacher || teacher.role !== UserRole.TEACHER) {
      throw new BadRequestException('المعلم غير صالح');
    }
    const start = input.sessionStartTime || input.weeklySessionTime || '20:00';
    const end = input.sessionEndTime || '21:00';
    const status = isSupervisor
      ? GroupStatus.OPEN
      : GroupStatus.PENDING_APPROVAL;
    const group = await this.ctx.groups.save(
      this.ctx.groups.create({
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
    await this.ctx.auditLog(actor.id, 'group.create', 'group', group.id, null, {
      name: group.name,
      status: group.status,
    });
    if (status === GroupStatus.PENDING_APPROVAL) {
      const supervisors = await this.ctx.users.find({
        where: [{ role: UserRole.SUPERVISOR }, { role: UserRole.ADMIN }],
      });
      for (const s of supervisors) {
        await this.ctx.notify(
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
    this.ctx.requireSupervisor(actor);
    const group = await this.getGroup(groupId);
    if (group.status !== GroupStatus.PENDING_APPROVAL) {
      throw new BadRequestException('المجموعة ليست بانتظار الموافقة');
    }
    if (approve) {
      group.status = GroupStatus.OPEN;
      await this.ctx.groups.save(group);
      await this.ctx.notify(
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
      await this.ctx.groups.save(group);
      await this.ctx.notify(
        group.teacherId,
        'group_rejected',
        'رُفض إنشاء المجموعة',
        reviewNote || `رفض المشرف مجموعة «${group.name}»`,
        { groupId: group.id },
      );
    }
    await this.ctx.auditLog(
      actor.id,
      'group.review_creation',
      'group',
      group.id,
      { status: GroupStatus.PENDING_APPROVAL },
      { status: group.status, reviewNote: reviewNote ?? null },
    );
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
    if (!isOwnerTeacher && !this.ctx.isSupervisor(actor)) {
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
      input.sessionStartTime ?? input.weeklySessionTime ?? undefined;
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
    await this.ctx.groups.save(group);
    await this.ctx.auditLog(
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
      const supervisors = await this.ctx.users.find({
        where: [{ role: UserRole.SUPERVISOR }, { role: UserRole.ADMIN }],
      });
      for (const s of supervisors) {
        await this.ctx.notify(
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
    const rows = await this.ctx.groups.find({ order: { createdAt: 'DESC' } });
    let filtered = rows;
    if (actor?.role === UserRole.STUDENT) {
      const gender = this.ctx.normalizeUserGender(actor.gender);
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

  async getGroup(id: string) {
    const group = await this.ctx.groups.findOne({ where: { id } });
    if (!group) throw new NotFoundException('المجموعة غير موجودة');
    return group;
  }

  /** Authenticated group fetch with membership/role checks (catalog-safe). */
  async getGroupForActor(actor: User, id: string) {
    const group = await this.enrichGroup(await this.getGroup(id));
    if (this.ctx.isSupervisor(actor)) return group;
    if (actor.role === UserRole.TEACHER && group.teacherId === actor.id) {
      return group;
    }
    if (actor.role === UserRole.STUDENT) {
      const member = await this.ctx.memberships.findOne({
        where: { userId: actor.id, groupId: id, leftAt: IsNull() },
      });
      if (member) return group;
      if (
        group.status === GroupStatus.OPEN ||
        group.status === GroupStatus.FULL
      ) {
        return group;
      }
    }
    throw new ForbiddenException();
  }

  async getGroupBrief(actor: User, id: string) {
    const group = await this.enrichGroup(await this.getGroup(id));
    this.ctx.assertCanViewGroup(actor, group.teacherId);
    const members = await this.ctx.memberships.find({
      where: { groupId: id, leftAt: IsNull() },
    });
    const today = new Date().toISOString().slice(0, 10);
    const allowReportContent = actor.role === UserRole.TEACHER;
    const students = [];
    for (const m of members) {
      const u = m.user;
      const report = await this.ctx.dailyReports.findOne({
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
    const members = await this.ctx.memberships.find({
      where: { groupId: id, leftAt: IsNull() },
    });
    const allowReportContent = actor.role === UserRole.TEACHER;
    const detailedStudents = [];
    for (const m of members) {
      const sid = m.userId;
      const [notes, infractions, quotas, attendance] = await Promise.all([
        this.ctx.notes.find({
          where: { studentId: sid },
          order: { noteDate: 'DESC' },
          take: 20,
        }),
        this.ctx.infractions.find({
          where: { studentId: sid },
          order: { createdAt: 'DESC' },
          take: 20,
        }),
        this.ctx.quotas.findOne({ where: { studentId: sid } }),
        this.ctx.attendance.find({
          where: { studentId: sid, groupId: id },
          order: { sessionDate: 'DESC' },
          take: 12,
        }),
      ]);
      let reports: unknown[] = [];
      let weekly: unknown[] = [];
      if (allowReportContent) {
        const reportRows = await this.ctx.dailyReports.find({
          where: { studentId: sid },
          order: { reportDate: 'DESC' },
          take: 14,
        });
        reports = await Promise.all(
          reportRows.map((r) => this.ctx.enrichDailyReport(r)),
        );
        const weeklyRows = await this.ctx.weeklyReports.find({
          where: { studentId: sid },
          order: { weekStartDate: 'DESC' },
          take: 8,
        });
        weekly = weeklyRows.map((w) => this.ctx.formatWeekly(w, 'detailed'));
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

  async enrichGroup(group: Group) {
    const teacher =
      group.teacher ||
      (await this.ctx.users.findOne({ where: { id: group.teacherId } }));
    const start = group.sessionStartTime || group.weeklySessionTime;
    const end = group.sessionEndTime || null;
    return {
      id: group.id,
      name: group.name,
      teacherId: group.teacherId,
      teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}` : null,
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
    const studentGender = this.ctx.normalizeUserGender(actor.gender);
    if (studentGender && group.gender !== studentGender) {
      throw new BadRequestException('هذه المجموعة لا تطابق جنسك');
    }
    const anyMembership = await this.ctx.memberships.findOne({
      where: { userId: actor.id, leftAt: IsNull() },
    });
    if (anyMembership) {
      throw new BadRequestException(
        'أنت منضم لمجموعة بالفعل — لا يمكن طلب مجموعة أخرى',
      );
    }
    const anyPending = await this.ctx.joinRequests.findOne({
      where: { studentId: actor.id, status: JoinRequestStatus.PENDING },
    });
    if (anyPending) {
      throw new BadRequestException(
        'لديك طلب انضمام قيد المراجعة — ألغِه أولاً أو انتظر الرد',
      );
    }
    const req = await this.ctx.joinRequests.save(
      this.ctx.joinRequests.create({
        student: actor,
        studentId: actor.id,
        group,
        groupId,
        status: JoinRequestStatus.PENDING,
      }),
    );
    await this.ctx.users.update(actor.id, { status: UserStatus.PENDING_GROUP });
    const recipients = new Set<string>([group.teacherId]);
    const supervisors = await this.ctx.users.find({
      where: [{ role: UserRole.SUPERVISOR }, { role: UserRole.ADMIN }],
    });
    for (const s of supervisors) recipients.add(s.id);
    for (const id of recipients) {
      await this.ctx.notify(
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
    const req = await this.ctx.joinRequests.findOne({ where: { id } });
    if (!req || req.studentId !== actor.id) {
      throw new NotFoundException('الطلب غير موجود');
    }
    if (req.status !== JoinRequestStatus.PENDING) {
      throw new BadRequestException('لا يمكن إلغاء طلب غير معلّق');
    }
    req.status = JoinRequestStatus.CANCELLED;
    await this.ctx.joinRequests.save(req);
    const stillPending = await this.ctx.joinRequests.findOne({
      where: { studentId: actor.id, status: JoinRequestStatus.PENDING },
    });
    const membership = await this.ctx.memberships.findOne({
      where: { userId: actor.id, leftAt: IsNull() },
    });
    if (!membership && !stillPending) {
      await this.ctx.users.update(actor.id, { status: UserStatus.NEW });
    }
    await this.ctx.auditLog(
      actor.id,
      'join_request.cancel',
      'join_request',
      id,
      null,
      {
        status: req.status,
      },
    );
    return req;
  }

  async listJoinRequests(actor: User) {
    if (actor.role === UserRole.STUDENT) {
      return this.ctx.joinRequests.find({
        where: { studentId: actor.id },
        order: { createdAt: 'DESC' },
      });
    }
    this.ctx.requireStaff(actor);
    const rows = await this.ctx.joinRequests.find({
      order: { createdAt: 'DESC' },
    });
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
    if (!this.ctx.isSupervisor(actor) && actor.role !== UserRole.TEACHER) {
      throw new ForbiddenException('صلاحية المشرف أو معلم المجموعة فقط');
    }
    const req = await this.ctx.joinRequests.findOne({ where: { id } });
    if (!req || req.status !== JoinRequestStatus.PENDING) {
      throw new BadRequestException('الطلب غير صالح للمراجعة');
    }
    const group = await this.getGroup(req.groupId);
    if (actor.role === UserRole.TEACHER && group.teacherId !== actor.id) {
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
      await this.ctx.joinRequests.save(req);
      await this.ctx.memberships.save(
        this.ctx.memberships.create({
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
      await this.ctx.groups.save(group);
      await this.ctx.users.update(req.studentId, { status: UserStatus.ACTIVE });
      await this.ctx.notify(
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
      await this.ctx.joinRequests.save(req);
      const stillPending = await this.ctx.joinRequests.findOne({
        where: { studentId: req.studentId, status: JoinRequestStatus.PENDING },
      });
      const membership = await this.ctx.memberships.findOne({
        where: { userId: req.studentId, leftAt: IsNull() },
      });
      if (!membership && !stillPending) {
        await this.ctx.users.update(req.studentId, { status: UserStatus.NEW });
      }
      await this.ctx.notify(
        req.studentId,
        'join_rejected',
        'تم رفض طلب الانضمام',
        reviewNote || 'تم رفض طلب الانضمام',
        { joinRequestId: req.id },
      );
    }
    await this.ctx.auditLog(
      actor.id,
      'join_request.review',
      'join_request',
      id,
      before,
      {
        status: req.status,
      },
    );
    return req;
  }

  async studentHasMembership(actor: User) {
    if (actor.role !== UserRole.STUDENT) return { hasGroup: true };
    const m = await this.ctx.memberships.findOne({
      where: { userId: actor.id, leftAt: IsNull() },
    });
    return { hasGroup: !!m, membership: m };
  }

  async listDirectory(actor: User) {
    this.ctx.requireSupervisor(actor);
    const [students, teachers, groups] = await Promise.all([
      this.ctx.users.find({
        where: { role: UserRole.STUDENT },
        order: { createdAt: 'DESC' },
      }),
      this.ctx.users.find({
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

  async myMembership(actor: User) {
    return this.ctx.memberships.findOne({
      where: { userId: actor.id, leftAt: IsNull() },
    });
  }

  membershipHistory(actor: User, studentId?: string) {
    const id =
      actor.role === UserRole.STUDENT ? actor.id : studentId || actor.id;
    if (
      actor.role === UserRole.STUDENT &&
      studentId &&
      studentId !== actor.id
    ) {
      throw new ForbiddenException();
    }
    return this.ctx.memberships.find({
      where: { userId: id },
      order: { joinedAt: 'DESC' },
    });
  }

  async changeGroup(
    actor: User,
    studentId: string,
    newGroupId: string,
    reason?: string,
  ) {
    this.ctx.requireSupervisor(actor);
    const current = await this.ctx.memberships.findOne({
      where: { userId: studentId, leftAt: IsNull() },
    });
    if (current) {
      current.leftAt = new Date();
      current.leaveReason = reason || 'group_change';
      await this.ctx.memberships.save(current);
      const oldGroup = await this.getGroup(current.groupId);
      oldGroup.currentStudentCount = Math.max(
        0,
        oldGroup.currentStudentCount - 1,
      );
      if (oldGroup.status === GroupStatus.FULL)
        oldGroup.status = GroupStatus.OPEN;
      await this.ctx.groups.save(oldGroup);
    }
    const group = await this.getGroup(newGroupId);
    if (group.currentStudentCount >= group.seatCount) {
      throw new BadRequestException('المجموعة الجديدة ممتلئة');
    }
    const membership = await this.ctx.memberships.save(
      this.ctx.memberships.create({
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
    await this.ctx.groups.save(group);
    await this.ctx.users.update(studentId, { status: UserStatus.ACTIVE });
    await this.ctx.auditLog(
      actor.id,
      'membership.change_group',
      'membership',
      membership.id,
      null,
      {
        studentId,
        newGroupId,
      },
    );
    return membership;
  }
}
