import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { DailyReport } from '../entities/daily-report.entity';
import { GroupMembership } from '../entities/group-membership.entity';
import { ReportDeadlineConfig } from '../entities/report-deadline-config.entity';
import { User } from '../entities/user.entity';
import { UserRole, UserStatus } from '../common/enums';
import { NotificationStub } from '../entities/notification-stub.entity';
import { PushService } from './push.service';

@Injectable()
export class ReminderService implements OnModuleInit {
  private readonly logger = new Logger(ReminderService.name);
  private lastEveningKey = '';
  private lastLateKey = '';

  constructor(
    @InjectRepository(ReportDeadlineConfig)
    private readonly deadlines: Repository<ReportDeadlineConfig>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(GroupMembership)
    private readonly memberships: Repository<GroupMembership>,
    @InjectRepository(DailyReport)
    private readonly dailyReports: Repository<DailyReport>,
    @InjectRepository(NotificationStub)
    private readonly notifications: Repository<NotificationStub>,
    private readonly push: PushService,
  ) {}

  async onModuleInit() {
    const rows = await this.deadlines.find({ take: 1 });
    const row = rows[0];
    if (!row) return;
    let changed = false;
    if (!row.enabled) {
      row.enabled = true;
      changed = true;
    }
    if (!row.reminderMinutesBefore) {
      row.reminderMinutesBefore = 60;
      changed = true;
    }
    if (changed) {
      row.notes =
        row.notes ||
        'تذكير قبل منتصف الليل للطلبة بلا تقرير. لا مخالفات تلقائية عند الإغلاق.';
      await this.deadlines.save(row);
      this.logger.log('Enabled report deadline reminders');
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async tickDeadlineReminders() {
    const cfg = await this.deadlines.find({ take: 1 });
    const row = cfg[0];
    if (!row?.enabled) return;

    const tz = row.timezone || 'Africa/Algiers';
    const close = row.closeTimeLocal || '23:59';
    const reminderMins = row.reminderMinutesBefore ?? 60;

    const nowParts = this.localParts(tz);
    const today = nowParts.date;
    const minutesNow = nowParts.hour * 60 + nowParts.minute;
    const [ch, cm] = close.split(':').map((x) => parseInt(x, 10));
    const closeMins = (ch || 23) * 60 + (cm || 59);

    const eveningTarget = Math.max(0, closeMins - reminderMins);
    const lateTarget = Math.max(0, closeMins - 15);

    const eveningKey = `${today}-evening`;
    const lateKey = `${today}-late`;

    if (this.near(minutesNow, eveningTarget) && this.lastEveningKey !== eveningKey) {
      this.lastEveningKey = eveningKey;
      await this.remindMissingStudents(today, 'deadline_reminder', reminderMins);
    }
    if (this.near(minutesNow, lateTarget) && this.lastLateKey !== lateKey) {
      this.lastLateKey = lateKey;
      await this.remindMissingStudents(today, 'deadline_reminder_final', 15);
    }
  }

  private near(now: number, target: number, window = 5) {
    return Math.abs(now - target) < window;
  }

  private localParts(timeZone: string) {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const parts = Object.fromEntries(
      fmt.formatToParts(new Date()).map((p) => [p.type, p.value]),
    );
    return {
      date: `${parts.year}-${parts.month}-${parts.day}`,
      hour: parseInt(parts.hour || '0', 10),
      minute: parseInt(parts.minute || '0', 10),
    };
  }

  private async remindMissingStudents(
    today: string,
    type: string,
    minutesLeft: number,
  ) {
    const members = await this.memberships.find({ where: { leftAt: IsNull() } });
    const studentIds = [...new Set(members.map((m) => m.userId))];
    if (!studentIds.length) return;

    const submitted = await this.dailyReports.find({
      where: { reportDate: today },
      select: ['studentId'],
    });
    const submittedSet = new Set(submitted.map((s) => s.studentId));
    const missing = studentIds.filter((id) => !submittedSet.has(id));

    let sent = 0;
    for (const studentId of missing) {
      const already = await this.notifications.findOne({
        where: { recipientId: studentId, type },
        order: { createdAt: 'DESC' },
      });
      if (already) {
        const created = already.createdAt.toISOString().slice(0, 10);
        if (created === today) continue;
      }
      const user = await this.users.findOne({ where: { id: studentId } });
      if (!user || user.role !== UserRole.STUDENT) continue;
      if (
        user.status === UserStatus.SUSPENDED ||
        user.status === UserStatus.WITHDRAWN ||
        user.status === UserStatus.PAUSED
      ) {
        continue;
      }

      await this.push.notify(
        studentId,
        type,
        'تذكير بتقرير اليوم',
        minutesLeft <= 20
          ? 'لم يتبقَّ سوى دقائق على منتصف الليل وما زال تقريرك غير مُرسل.'
          : `اقترب موعد إغلاق اليوم (~${minutesLeft} دقيقة). أرسل تقريرك قبل منتصف الليل.`,
        { reportDate: today, minutesLeft },
      );
      sent++;
    }
    this.logger.log(`Deadline reminders (${type}): ${sent} students for ${today}`);
  }
}
