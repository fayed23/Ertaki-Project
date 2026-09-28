import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { IsNull } from 'typeorm';
import { UserRole, AttendanceStatus, DailyReportStatus } from '../common/enums';
import { User } from '../entities/user.entity';
import { WeeklyReport } from '../entities/weekly-report.entity';
import { DailyReport } from '../entities/daily-report.entity';
import { DomainContext } from './domain-context';

@Injectable()
export class ReportsService {
  constructor(private readonly ctx: DomainContext) {}

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
    const existing = await this.ctx.dailyReports.findOne({
      where: { studentId: actor.id, reportDate: input.reportDate },
    });
    if (existing && existing.status !== DailyReportStatus.EXCUSED) {
      throw new BadRequestException('لا يمكن تعديل التقرير بعد الإرسال');
    }
    const range = this.ctx.validateQalunMemorizationRange(input);
    const payload = {
      student: actor,
      studentId: actor.id,
      reportDate: input.reportDate,
      status: DailyReportStatus.SUBMITTED,
      excuseRequestId: existing?.excuseRequestId ?? null,
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
    };
    const report = await this.ctx.dailyReports.save(
      existing
        ? Object.assign(existing, payload)
        : this.ctx.dailyReports.create(payload),
    );
    await this.ctx.evaluateContentInfractions(actor.id, report);
    await this.ctx.auditLog(
      actor.id,
      'daily_report.submit',
      'daily_report',
      report.id,
      null,
      { reportDate: report.reportDate },
    );
    await this.ctx.notifyTeacherAboutStudent(
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
    return this.ctx.enrichDailyReport(report);
  }

  async listDailyReports(
    actor: User,
    filters: { studentId?: string; reportDate?: string; groupId?: string },
  ) {
    let rows: DailyReport[];
    if (actor.role === UserRole.STUDENT) {
      if (filters.studentId && filters.studentId !== actor.id) {
        throw new ForbiddenException('لا يمكن عرض تقارير الزملاء');
      }
      rows = await this.ctx.dailyReports.find({
        where: {
          studentId: actor.id,
          ...(filters.reportDate ? { reportDate: filters.reportDate } : {}),
        },
        order: { reportDate: 'DESC' },
      });
      return Promise.all(rows.map((r) => this.ctx.enrichDailyReport(r)));
    }
    if (this.ctx.isSupervisor(actor)) {
      throw new ForbiddenException(
        'التقارير اليومية متاحة للمعلم فقط — المشرف لا يطّلع على محتوى التقارير',
      );
    }
    this.ctx.requireTeacher(actor);
    if (filters.studentId) {
      await this.ctx.assertTeacherOwnsStudent(actor, filters.studentId);
      rows = await this.ctx.dailyReports.find({
        where: {
          studentId: filters.studentId,
          ...(filters.reportDate ? { reportDate: filters.reportDate } : {}),
        },
        order: { reportDate: 'DESC' },
      });
      return Promise.all(rows.map((r) => this.ctx.enrichDailyReport(r)));
    }
    const myGroups = await this.ctx.groups.find({
      where: { teacherId: actor.id },
    });
    const ids = myGroups.map((g) => g.id);
    let groupId = filters.groupId;
    if (groupId && !ids.includes(groupId)) {
      throw new ForbiddenException();
    }
    if (!groupId && ids.length === 1) groupId = ids[0];
    if (!groupId) {
      const memberIds = (
        await this.ctx.memberships.find({
          where: ids.map((id) => ({ groupId: id, leftAt: IsNull() })),
        })
      ).map((m) => m.userId);
      if (!memberIds.length) return [];
      rows = await this.ctx.dailyReports
        .createQueryBuilder('r')
        .leftJoinAndSelect('r.student', 'student')
        .where('r.studentId IN (:...memberIds)', { memberIds })
        .orderBy('r.reportDate', 'DESC')
        .addOrderBy('r.submittedAt', 'DESC')
        .take(200)
        .getMany();
      return Promise.all(rows.map((r) => this.ctx.enrichDailyReport(r)));
    }
    const members = await this.ctx.memberships.find({
      where: { groupId, leftAt: IsNull() },
    });
    const memberIds = members.map((m) => m.userId);
    if (!memberIds.length) return [];
    const qb = this.ctx.dailyReports
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.student', 'student')
      .where('r.studentId IN (:...memberIds)', { memberIds });
    if (filters.reportDate) {
      qb.andWhere('r.reportDate = :d', { d: filters.reportDate });
    }
    rows = await qb
      .orderBy('r.reportDate', 'DESC')
      .addOrderBy('r.submittedAt', 'DESC')
      .take(200)
      .getMany();
    return Promise.all(rows.map((r) => this.ctx.enrichDailyReport(r)));
  }

  async getDailyReport(actor: User, id: string) {
    const report = await this.ctx.dailyReports.findOne({ where: { id } });
    if (!report) throw new NotFoundException('التقرير غير موجود');
    if (actor.role === UserRole.STUDENT) {
      if (report.studentId !== actor.id) throw new ForbiddenException();
    } else if (this.ctx.isSupervisor(actor)) {
      throw new ForbiddenException(
        'التقارير اليومية متاحة للمعلم فقط — المشرف لا يطّلع على محتوى التقارير',
      );
    } else {
      this.ctx.requireTeacher(actor);
      await this.ctx.assertTeacherOwnsStudent(actor, report.studentId);
    }
    return this.ctx.enrichDailyReport(report);
  }

  async generateWeeklyReport(
    actor: User | null,
    studentId: string,
    weekStartDate: string,
    weekEndDate: string,
    opts?: { silent?: boolean; sessionDate?: string; groupId?: string },
  ) {
    if (actor) {
      if (this.ctx.isSupervisor(actor)) {
        throw new ForbiddenException(
          'التقارير الأسبوعية للمعلم فقط — المشرف لا يولّد أو يطّلع على محتوى التقارير',
        );
      }
      this.ctx.requireTeacher(actor);
      await this.ctx.assertTeacherOwnsStudent(actor, studentId);
    }
    const membership = await this.ctx.memberships.findOne({
      where: { userId: studentId, leftAt: IsNull() },
    });
    const groupId = opts?.groupId ?? membership?.groupId ?? null;
    const dailies = await this.ctx.dailyReports
      .createQueryBuilder('r')
      .where('r.studentId = :studentId', { studentId })
      .andWhere('r.reportDate >= :start', { start: weekStartDate })
      .andWhere('r.reportDate <= :end', { end: weekEndDate })
      .getMany();
    const att = groupId
      ? await this.ctx.attendance
          .createQueryBuilder('a')
          .where('a.studentId = :studentId', { studentId })
          .andWhere('a.groupId = :groupId', { groupId })
          .andWhere('a.sessionDate >= :start', { start: weekStartDate })
          .andWhere('a.sessionDate <= :end', { end: weekEndDate })
          .getMany()
      : [];
    const byDate = new Map(dailies.map((d) => [d.reportDate, d]));
    const days = this.ctx.eachDateInclusive(weekStartDate, weekEndDate);
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
      if (r.status === DailyReportStatus.EXCUSED) {
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
      : (att.find((a) => a.status === AttendanceStatus.PRESENT) ?? att[0]);
    const attendedMajlis = sessionRow
      ? sessionRow.status === AttendanceStatus.PRESENT
      : att.some((a) => a.status === AttendanceStatus.PRESENT);
    let existing = await this.ctx.weeklyReports.findOne({
      where: { studentId, weekStartDate },
    });
    const wasNew = !existing;
    const payload = {
      studentId,
      groupId,
      weekStartDate,
      weekEndDate,
      dailyReportsSubmitted: dailies.filter(
        (d) => d.status !== DailyReportStatus.EXCUSED,
      ).length,
      quotaDaysMet: dailies.filter((d) => d.memorizedQuota).length,
      fiftyRepsDaysMet: dailies.filter((d) => d.completedFiftyRepetitions)
        .length,
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
      existing = this.ctx.weeklyReports.create(payload);
    }
    const saved = await this.ctx.weeklyReports.save(existing);
    if (!opts?.silent && wasNew) {
      await this.ctx.notify(
        studentId,
        'weekly_report',
        'تقرير أسبوعي جاهز للتأكيد',
        `الأسبوع ${weekStartDate} — ${weekEndDate}`,
        { weeklyReportId: saved.id },
      );
    }
    return (
      (await this.ctx.weeklyReports.findOne({ where: { id: saved.id } })) ??
      saved
    );
  }

  /**
   * Teacher saves weekly مجلس attendance for a group, then weekly reports
   * are generated/updated for each student (PDF «التقرير الأسبوعي» fields).
   */
  async autoGenerateWeeklyReports(timezone = 'Africa/Algiers') {
    const { weekStart, weekEnd } = this.ctx.previousWeekBounds(timezone);
    const members = await this.ctx.memberships.find({
      where: { leftAt: IsNull() },
    });
    const studentIds = [...new Set(members.map((m) => m.userId))];
    let created = 0;
    let skippedNoAttendance = 0;
    for (const studentId of studentIds) {
      const existing = await this.ctx.weeklyReports.findOne({
        where: { studentId, weekStartDate: weekStart },
      });
      if (existing) continue;
      const membership = members.find((m) => m.userId === studentId);
      if (!membership?.groupId) {
        skippedNoAttendance++;
        continue;
      }
      const hasAttendance = await this.ctx.attendance
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
      await this.ctx.notify(
        studentId,
        'weekly_report',
        'تقريرك الأسبوعي جاهز',
        `الأسبوع ${weekStart} — ${weekEnd}`,
        { weeklyReportId: saved.id },
      );
      const group = await this.ctx.groups.findOne({
        where: { id: membership.groupId },
      });
      if (group?.teacherId) {
        await this.ctx.notify(
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
  async confirmWeeklyReport(actor: User, id: string) {
    const report = await this.ctx.weeklyReports.findOne({ where: { id } });
    if (!report) throw new NotFoundException();
    if (actor.role === UserRole.STUDENT && report.studentId !== actor.id) {
      throw new ForbiddenException();
    }
    if (actor.role === UserRole.TEACHER) {
      await this.ctx.assertTeacherOwnsStudent(actor, report.studentId);
    } else if (actor.role !== UserRole.STUDENT) {
      throw new ForbiddenException(
        'التقارير الأسبوعية متاحة للمعلم والطالب فقط',
      );
    }
    report.studentConfirmedAt = new Date();
    return this.ctx.weeklyReports.save(report);
  }

  async listWeeklyReports(
    actor: User,
    studentId?: string,
    mode: 'brief' | 'detailed' = 'brief',
  ) {
    if (this.ctx.isSupervisor(actor)) {
      throw new ForbiddenException(
        'التقارير الأسبوعية متاحة للمعلم فقط — المشرف لا يطّلع عليها',
      );
    }
    let rows: WeeklyReport[];
    if (actor.role === UserRole.STUDENT) {
      rows = await this.ctx.weeklyReports.find({
        where: { studentId: actor.id },
        order: { weekStartDate: 'DESC' },
      });
    } else {
      this.ctx.requireTeacher(actor);
      if (!studentId) {
        const groups = await this.ctx.groups.find({
          where: { teacherId: actor.id },
        });
        const gids = groups.map((g) => g.id);
        if (!gids.length) return [];
        rows = await this.ctx.weeklyReports
          .createQueryBuilder('w')
          .leftJoinAndSelect('w.student', 'student')
          .leftJoinAndSelect('w.group', 'group')
          .where('w.groupId IN (:...gids)', { gids })
          .orderBy('w.weekStartDate', 'DESC')
          .take(200)
          .getMany();
      } else {
        await this.ctx.assertTeacherOwnsStudent(actor, studentId);
        rows = await this.ctx.weeklyReports.find({
          where: { studentId },
          order: { weekStartDate: 'DESC' },
          take: 200,
        });
      }
    }
    return rows.map((w) => this.ctx.formatWeekly(w, mode));
  }

  async getWeeklyReport(
    actor: User,
    id: string,
    mode: 'brief' | 'detailed' = 'detailed',
  ) {
    if (this.ctx.isSupervisor(actor)) {
      throw new ForbiddenException(
        'التقارير الأسبوعية متاحة للمعلم فقط — المشرف لا يطّلع عليها',
      );
    }
    const report = await this.ctx.weeklyReports.findOne({ where: { id } });
    if (!report) throw new NotFoundException();
    if (actor.role === UserRole.STUDENT && report.studentId !== actor.id) {
      throw new ForbiddenException();
    }
    if (actor.role === UserRole.TEACHER) {
      await this.ctx.assertTeacherOwnsStudent(actor, report.studentId);
    } else if (actor.role !== UserRole.STUDENT) {
      throw new ForbiddenException();
    }
    return this.ctx.formatWeekly(report, mode);
  }
}
