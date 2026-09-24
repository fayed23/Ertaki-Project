import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DomainController } from './domain.controller';
import { DomainService } from './domain.service';
import { PushService } from './push.service';
import { ReminderService } from './reminder.service';
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
import { DeviceToken } from '../entities/device-token.entity';

const entities = [
  User,
  Group,
  GroupMembership,
  JoinRequest,
  DailyReport,
  WeeklyReport,
  TrimestrialReport,
  Attendance,
  AbsenceExcuseRequest,
  StudentNote,
  Infraction,
  InfractionPolicy,
  StudentQuota,
  NotificationStub,
  ProgramContent,
  ReportDeadlineConfig,
  AuditLog,
  DeviceToken,
];

@Module({
  imports: [TypeOrmModule.forFeature(entities)],
  controllers: [DomainController],
  providers: [DomainService, PushService, ReminderService],
  exports: [DomainService, PushService, TypeOrmModule],
})
export class DomainModule {}

export { entities };
