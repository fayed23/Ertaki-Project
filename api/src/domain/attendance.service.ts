import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  InfractionType,
  NoteVisibility,
  UserRole,
  AttendanceStatus,
  ExcuseRequestStatus,
} from '../common/enums';
import { User } from '../entities/user.entity';
import { DomainContext } from './domain-context';
import { ReportsService } from './reports.service';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly ctx: DomainContext,
    private readonly reports: ReportsService,
  ) {}

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
    this.ctx.requireStaff(actor);
    let row = await this.ctx.attendance.findOne({
      where: {
        studentId: input.studentId,
        groupId: input.groupId,
        sessionDate: input.sessionDate,
      },
    });
    if (!row) {
      row = this.ctx.attendance.create({
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
    const saved = await this.ctx.attendance.save(row);
    if (input.status === AttendanceStatus.UNEXCUSED) {
      await this.ctx.recordInfraction(
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
      const student = await this.ctx.users.findOne({
        where: { id: input.studentId },
      });
      const label =
        input.status === AttendanceStatus.EXCUSED
          ? 'غياب بعذر'
          : 'غياب بلا عذر';
      await this.ctx.notifyStaffAboutStudent(
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
        await this.ctx.notify(
          student.id,
          'attendance_absence',
          label,
          `تم تسجيل ${label} لتاريخ ${input.sessionDate}`,
          { sessionDate: input.sessionDate, status: input.status },
        );
      }
    }
    await this.ctx.auditLog(
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
    this.ctx.requireStaff(actor);
    return this.ctx.attendance.find({
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
    const row = await this.ctx.excuses.save(
      this.ctx.excuses.create({
        studentId: actor.id,
        groupId: input.groupId,
        sessionDate: input.sessionDate,
        reason: input.reason,
        status: ExcuseRequestStatus.PENDING,
      }),
    );
    await this.ctx.notifyStaffAboutStudent(
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
    this.ctx.requireStaff(actor);
    const row = await this.ctx.excuses.findOne({ where: { id } });
    if (!row || row.status !== ExcuseRequestStatus.PENDING) {
      throw new BadRequestException('الطلب غير صالح');
    }
    const before = { status: row.status };
    row.status = approve
      ? ExcuseRequestStatus.APPROVED
      : ExcuseRequestStatus.REJECTED;
    row.reviewedById = actor.id;
    await this.ctx.excuses.save(row);
    if (approve) {
      await this.recordAttendance(actor, {
        studentId: row.studentId,
        groupId: row.groupId,
        sessionDate: row.sessionDate,
        status: AttendanceStatus.EXCUSED,
        note: row.reason,
      });
    }
    await this.ctx.auditLog(
      actor.id,
      'excuse.review',
      'absence_excuse_request',
      row.id,
      before,
      { status: row.status, approve },
    );
    return row;
  }

  listExcuses(actor: User) {
    if (actor.role === UserRole.STUDENT) {
      return this.ctx.excuses.find({
        where: { studentId: actor.id },
        order: { createdAt: 'DESC' },
      });
    }
    this.ctx.requireStaff(actor);
    return this.ctx.excuses.find({ order: { createdAt: 'DESC' } });
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
    this.ctx.requireStaff(actor);
    const note = await this.ctx.notes.save(
      this.ctx.notes.create({
        studentId: input.studentId,
        authorId: actor.id,
        body: input.body,
        visibility: input.visibility,
        noteDate: input.noteDate,
      }),
    );
    await this.ctx.auditLog(
      actor.id,
      'note.create',
      'student_note',
      note.id,
      null,
      {
        studentId: note.studentId,
        visibility: note.visibility,
        noteDate: note.noteDate,
      },
    );
    if (input.visibility === NoteVisibility.STUDENT_VISIBLE) {
      await this.ctx.notify(
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
      return this.ctx.notes.find({
        where: {
          studentId: actor.id,
          visibility: NoteVisibility.STUDENT_VISIBLE,
        },
        order: { noteDate: 'DESC' },
      });
    }
    this.ctx.requireStaff(actor);
    return this.ctx.notes.find({
      where: studentId ? { studentId } : {},
      order: { noteDate: 'DESC' },
      take: 200,
    });
  }

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
    if (this.ctx.isSupervisor(actor)) {
      throw new ForbiddenException(
        'حفظ حضور المجلس الأسبوعي وتوليد التقارير للمعلم فقط',
      );
    }
    this.ctx.requireTeacher(actor);
    const group = await this.ctx.groups.findOne({
      where: { id: input.groupId },
    });
    if (!group) throw new NotFoundException('المجموعة غير موجودة');
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
    const { weekStart, weekEnd } = this.ctx.weekBoundsForDate(
      input.sessionDate,
    );
    const reports = [];
    for (const entry of input.entries) {
      const saved = await this.reports.generateWeeklyReport(
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
        (await this.ctx.weeklyReports.findOne({ where: { id: saved.id } })) ??
        saved;
      reports.push(full);
      await this.ctx.notify(
        entry.studentId,
        'weekly_report',
        'تقريرك الأسبوعي جاهز',
        `بعد مجلس التسميع · ${weekStart} — ${weekEnd}`,
        { weeklyReportId: saved.id, groupId: input.groupId },
      );
    }
    await this.ctx.notify(
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
    await this.ctx.auditLog(
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
      weeklyReports: reports.map((w) => this.ctx.formatWeekly(w, 'detailed')),
      generated: reports.length,
    };
  }

  /**
   * Fallback only: previous Sat–Fri week, and only for students who already
   * have weekly attendance saved that week but still lack a weekly report.
   */
}
