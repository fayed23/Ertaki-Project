import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createReadStream, existsSync } from 'fs';
import { basename, extname, join } from 'path';
import { randomUUID } from 'crypto';
import { writeFileSync } from 'fs';
import { In, IsNull } from 'typeorm';
import {
  AttendanceStatus,
  DailyReportStatus,
  StudentRequestStatus,
  StudentRequestType,
  UserRole,
} from '../common/enums';
import { User } from '../entities/user.entity';
import { StudentRequest } from '../entities/student-request.entity';
import { DomainContext } from './domain-context';
import {
  isAllowedStudentRequestFile,
  studentRequestUploadRoot,
  STUDENT_REQUEST_MAX_BYTES,
} from './student-request-upload';

export type StudentRequestFilters = {
  status?: string;
  type?: string;
  studentId?: string;
  groupId?: string;
  teacherId?: string;
  from?: string;
  to?: string;
};

@Injectable()
export class StudentRequestsService {
  constructor(private readonly ctx: DomainContext) {}

  private typeLabel(type: StudentRequestType): string {
    return type === StudentRequestType.DAILY_REPORT_EXCUSE
      ? 'عذر تقرير يومي'
      : 'غياب مجلس تسميع';
  }

  private serialize(row: StudentRequest) {
    const {
      attachmentPath: _path,
      ...rest
    } = row;
    return {
      ...rest,
      hasAttachment: !!row.attachmentPath,
      attachmentUrl: row.attachmentPath
        ? `/student-requests/${row.id}/attachment`
        : null,
    };
  }

  private async activeMembership(studentId: string) {
    return this.ctx.memberships.findOne({
      where: { userId: studentId, leftAt: IsNull() },
      relations: ['group'],
    });
  }

  private async assertTeacherOwnsGroup(actor: User, groupId: string) {
    if (this.ctx.isSupervisor(actor)) return;
    this.ctx.requireTeacher(actor);
    const group = await this.ctx.groups.findOne({ where: { id: groupId } });
    if (!group || group.teacherId !== actor.id) {
      throw new ForbiddenException('لا صلاحية على طلبات هذه المجموعة');
    }
  }

  async create(
    actor: User,
    input: {
      type: StudentRequestType;
      relevantDate: string;
      reason: string;
      groupId?: string;
    },
    file?: Express.Multer.File,
  ) {
    if (actor.role !== UserRole.STUDENT) throw new ForbiddenException();
    const reason = (input.reason || '').trim();
    if (!reason) throw new BadRequestException('السبب مطلوب');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.relevantDate || '')) {
      throw new BadRequestException('التاريخ غير صالح');
    }
    if (
      !Object.values(StudentRequestType).includes(input.type as StudentRequestType)
    ) {
      throw new BadRequestException('نوع الطلب غير مدعوم');
    }

    const membership = await this.activeMembership(actor.id);
    if (!membership) {
      throw new BadRequestException('يجب الانضمام لمجموعة أولاً');
    }
    const groupId = input.groupId || membership.groupId;
    if (groupId !== membership.groupId) {
      throw new ForbiddenException('المجموعة غير مطابقة لعضويتك');
    }
    const group =
      membership.group ||
      (await this.ctx.groups.findOne({ where: { id: groupId } }));
    if (!group) throw new NotFoundException('المجموعة غير موجودة');

    const dup = await this.ctx.studentRequests.findOne({
      where: {
        studentId: actor.id,
        type: input.type,
        relevantDate: input.relevantDate,
        status: StudentRequestStatus.PENDING,
      },
    });
    if (dup) {
      throw new BadRequestException('يوجد طلب معلّق بنفس النوع والتاريخ');
    }

    let attachmentPath: string | null = null;
    let attachmentOriginalName: string | null = null;
    let attachmentMime: string | null = null;
    let attachmentSize: number | null = null;

    if (file) {
      if (file.size > STUDENT_REQUEST_MAX_BYTES) {
        throw new BadRequestException('حجم الملف يتجاوز 5 ميغابايت');
      }
      if (!isAllowedStudentRequestFile(file.originalname, file.mimetype)) {
        throw new BadRequestException('نوع الملف غير مسموح (PDF/JPG/PNG فقط)');
      }
      const ext = extname(file.originalname).toLowerCase() || '.bin';
      const stored = `${randomUUID()}${ext}`;
      const dest = join(studentRequestUploadRoot(), stored);
      writeFileSync(dest, file.buffer);
      attachmentPath = stored;
      attachmentOriginalName = basename(file.originalname).slice(0, 180);
      attachmentMime = file.mimetype;
      attachmentSize = file.size;
    }

    const row = await this.ctx.studentRequests.save(
      this.ctx.studentRequests.create({
        studentId: actor.id,
        groupId,
        teacherId: group.teacherId,
        type: input.type,
        relevantDate: input.relevantDate,
        reason,
        attachmentPath,
        attachmentOriginalName,
        attachmentMime,
        attachmentSize,
        status: StudentRequestStatus.PENDING,
        reviewerId: null,
        reviewerNote: null,
        reviewedAt: null,
      }),
    );

    await this.ctx.auditLog(
      actor.id,
      'student_request.create',
      'student_request',
      row.id,
      null,
      { type: row.type, relevantDate: row.relevantDate },
    );

    await this.ctx.notifyStaffAboutStudent(
      actor.id,
      'excuse_submitted',
      `طلب جديد: ${this.typeLabel(row.type)}`,
      `${actor.firstName} ${actor.lastName}: ${reason.slice(0, 120)}`,
      {
        requestId: row.id,
        excuseId: row.id,
        type: row.type,
        relevantDate: row.relevantDate,
        groupId: row.groupId,
      },
    );

    const full = await this.ctx.studentRequests.findOne({
      where: { id: row.id },
    });
    return this.serialize(full!);
  }

  async list(actor: User, filters: StudentRequestFilters = {}) {
    const where: Record<string, unknown> = {};
    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = filters.type;
    if (filters.studentId) where.studentId = filters.studentId;
    if (filters.groupId) where.groupId = filters.groupId;
    if (filters.teacherId) where.teacherId = filters.teacherId;

    if (actor.role === UserRole.STUDENT) {
      where.studentId = actor.id;
    } else if (actor.role === UserRole.TEACHER) {
      const groups = await this.ctx.groups.find({
        where: { teacherId: actor.id },
      });
      const ids = groups.map((g) => g.id);
      if (!ids.length) return [];
      if (filters.groupId && !ids.includes(filters.groupId)) {
        throw new ForbiddenException();
      }
      where.groupId = filters.groupId ? filters.groupId : In(ids);
    } else {
      this.ctx.requireSupervisor(actor);
    }

    let rows = await this.ctx.studentRequests.find({
      where,
      order: { createdAt: 'DESC' },
      take: 500,
    });

    if (filters.from) {
      rows = rows.filter((r) => r.relevantDate >= filters.from!);
    }
    if (filters.to) {
      rows = rows.filter((r) => r.relevantDate <= filters.to!);
    }
    return rows.map((r) => this.serialize(r));
  }

  async stats(actor: User) {
    this.ctx.requireSupervisor(actor);
    const rows = await this.ctx.studentRequests.find();
    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byGroup: Record<string, number> = {};
    const byTeacher: Record<string, number> = {};
    const byStudent: Record<string, number> = {};
    for (const r of rows) {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      byType[r.type] = (byType[r.type] || 0) + 1;
      byGroup[r.groupId] = (byGroup[r.groupId] || 0) + 1;
      if (r.teacherId) {
        byTeacher[r.teacherId] = (byTeacher[r.teacherId] || 0) + 1;
      }
      byStudent[r.studentId] = (byStudent[r.studentId] || 0) + 1;
    }
    return {
      total: rows.length,
      pending: byStatus[StudentRequestStatus.PENDING] || 0,
      approved: byStatus[StudentRequestStatus.APPROVED] || 0,
      rejected: byStatus[StudentRequestStatus.REJECTED] || 0,
      cancelled: byStatus[StudentRequestStatus.CANCELLED] || 0,
      byStatus,
      byType,
      byGroup,
      byTeacher,
      byStudent,
    };
  }

  async getOne(actor: User, id: string) {
    const row = await this.ctx.studentRequests.findOne({ where: { id } });
    if (!row) throw new NotFoundException();
    await this.assertCanView(actor, row);
    return this.serialize(row);
  }

  private async assertCanView(actor: User, row: StudentRequest) {
    if (actor.role === UserRole.STUDENT) {
      if (row.studentId !== actor.id) throw new ForbiddenException();
      return;
    }
    await this.assertTeacherOwnsGroup(actor, row.groupId);
  }

  async cancel(actor: User, id: string) {
    if (actor.role !== UserRole.STUDENT) throw new ForbiddenException();
    const row = await this.ctx.studentRequests.findOne({ where: { id } });
    if (!row || row.studentId !== actor.id) throw new NotFoundException();
    if (row.status !== StudentRequestStatus.PENDING) {
      throw new BadRequestException('لا يمكن إلغاء طلب تمت مراجعته');
    }
    const before = { status: row.status };
    row.status = StudentRequestStatus.CANCELLED;
    await this.ctx.studentRequests.save(row);
    await this.ctx.auditLog(
      actor.id,
      'student_request.cancel',
      'student_request',
      row.id,
      before,
      { status: row.status },
    );
    return this.serialize(row);
  }

  async review(
    actor: User,
    id: string,
    input: { approve: boolean; reviewerNote?: string },
  ) {
    this.ctx.requireStaff(actor);
    const row = await this.ctx.studentRequests.findOne({ where: { id } });
    if (!row || row.status !== StudentRequestStatus.PENDING) {
      throw new BadRequestException('الطلب غير صالح للمراجعة');
    }
    await this.assertTeacherOwnsGroup(actor, row.groupId);

    const before = {
      status: row.status,
      reviewerNote: row.reviewerNote,
    };
    row.status = input.approve
      ? StudentRequestStatus.APPROVED
      : StudentRequestStatus.REJECTED;
    row.reviewerId = actor.id;
    row.reviewerNote = (input.reviewerNote || '').trim() || null;
    row.reviewedAt = new Date();
    await this.ctx.studentRequests.save(row);

    if (input.approve) {
      if (row.type === StudentRequestType.WEEKLY_SESSION_ABSENCE) {
        await this.applyWeeklyExcuse(actor, row);
      } else if (row.type === StudentRequestType.DAILY_REPORT_EXCUSE) {
        await this.applyDailyExcuse(row);
      }
    }

    await this.ctx.auditLog(
      actor.id,
      input.approve ? 'student_request.approve' : 'student_request.reject',
      'student_request',
      row.id,
      before,
      {
        status: row.status,
        reviewerNote: row.reviewerNote,
      },
    );

    const outcome = input.approve ? 'تمت الموافقة على' : 'تم رفض';
    await this.ctx.notify(
      row.studentId,
      'excuse_reviewed',
      `${outcome} طلبك`,
      `${this.typeLabel(row.type)} · ${row.relevantDate}${
        row.reviewerNote ? ` — ${row.reviewerNote.slice(0, 80)}` : ''
      }`,
      {
        requestId: row.id,
        excuseId: row.id,
        type: row.type,
        status: row.status,
        relevantDate: row.relevantDate,
      },
    );

    const full = await this.ctx.studentRequests.findOne({
      where: { id: row.id },
    });
    return this.serialize(full!);
  }

  private async applyWeeklyExcuse(actor: User, row: StudentRequest) {
    let att = await this.ctx.attendance.findOne({
      where: {
        studentId: row.studentId,
        groupId: row.groupId,
        sessionDate: row.relevantDate,
      },
    });
    if (!att) {
      att = this.ctx.attendance.create({
        studentId: row.studentId,
        groupId: row.groupId,
        sessionDate: row.relevantDate,
        status: AttendanceStatus.EXCUSED,
        arrivedLate: false,
        leftEarly: false,
        note: row.reason,
        recordedById: actor.id,
        excuseRequestId: row.id,
      });
    } else {
      att.status = AttendanceStatus.EXCUSED;
      att.note = row.reason;
      att.recordedById = actor.id;
      att.excuseRequestId = row.id;
    }
    await this.ctx.attendance.save(att);
  }

  private async applyDailyExcuse(row: StudentRequest) {
    let report = await this.ctx.dailyReports.findOne({
      where: {
        studentId: row.studentId,
        reportDate: row.relevantDate,
      },
    });
    if (!report) {
      report = this.ctx.dailyReports.create({
        studentId: row.studentId,
        reportDate: row.relevantDate,
        status: DailyReportStatus.EXCUSED,
        excuseRequestId: row.id,
        memorizedQuota: false,
        completedFiftyRepetitions: false,
        repeatedInOneSitting: false,
        readTafsir: false,
        submittedAt: new Date(),
      });
    } else {
      // Keep submitted content if present; mark as excused link for history.
      report.status = DailyReportStatus.EXCUSED;
      report.excuseRequestId = row.id;
    }
    await this.ctx.dailyReports.save(report);
  }

  async openAttachment(actor: User, id: string) {
    const row = await this.ctx.studentRequests.findOne({ where: { id } });
    if (!row || !row.attachmentPath) throw new NotFoundException();
    await this.assertCanView(actor, row);
    const abs = join(studentRequestUploadRoot(), row.attachmentPath);
    if (!existsSync(abs)) throw new NotFoundException('الملف غير موجود');
    return {
      stream: createReadStream(abs),
      mime: row.attachmentMime || 'application/octet-stream',
      filename: row.attachmentOriginalName || row.attachmentPath,
    };
  }

  /** Legacy weekly-only API shape. */
  async legacyRequestExcuse(
    actor: User,
    input: { groupId: string; sessionDate: string; reason: string },
  ) {
    return this.create(actor, {
      type: StudentRequestType.WEEKLY_SESSION_ABSENCE,
      relevantDate: input.sessionDate,
      reason: input.reason,
      groupId: input.groupId,
    });
  }

  async legacyReviewExcuse(actor: User, id: string, approve: boolean) {
    return this.review(actor, id, { approve });
  }

  async legacyListExcuses(actor: User) {
    const rows = await this.list(actor, {
      type: StudentRequestType.WEEKLY_SESSION_ABSENCE,
    });
    // Map to legacy field names used by older clients.
    return rows.map((r) => ({
      ...r,
      sessionDate: r.relevantDate,
      reviewedById: r.reviewerId,
    }));
  }
}
