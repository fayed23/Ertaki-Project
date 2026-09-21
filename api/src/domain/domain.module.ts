import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DomainController } from './domain.controller';
import { DomainService } from './domain.service';
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

const entities = [
  User,
  Group,
  GroupMembership,
  JoinRequest,
  DailyReport,
  WeeklyReport,
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
];

@Module({
  imports: [TypeOrmModule.forFeature(entities)],
  controllers: [DomainController],
  providers: [DomainService],
  exports: [DomainService, TypeOrmModule],
})
export class DomainModule {}

export { entities };
