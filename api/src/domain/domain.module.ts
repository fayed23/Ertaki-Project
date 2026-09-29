import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DomainService } from './domain.service';
import { DomainContext } from './domain-context';
import { GroupsService } from './groups.service';
import { ReportsService } from './reports.service';
import { AttendanceService } from './attendance.service';
import { PoliciesService } from './policies.service';
import { NotificationsService } from './notifications.service';
import { DashboardsService } from './dashboards.service';
import { PushService } from './push.service';
import { ReminderService } from './reminder.service';
import { GroupsController } from './groups.controller';
import { ReportsController } from './reports.controller';
import { AttendanceController } from './attendance.controller';
import { PoliciesController } from './policies.controller';
import { NotificationsController } from './notifications.controller';
import { DashboardsController } from './dashboards.controller';
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
import { DeviceToken } from '../entities/device-token.entity';
import { StudentRequestsService } from './student-requests.service';
import { StudentRequestsController } from './student-requests.controller';
import { MemorizationService } from './memorization.service';
import { MemorizationController } from './memorization.controller';
import { MemorizationPlan } from '../entities/memorization-plan.entity';
import { MemorizationProgress } from '../entities/memorization-progress.entity';
import { MemorizationProgressHistory } from '../entities/memorization-progress-history.entity';
import { MemorizationHizbCompletion } from '../entities/memorization-hizb-completion.entity';
import { MemorizationAchievement } from '../entities/memorization-achievement.entity';
import { MemorizationAssessment } from '../entities/memorization-assessment.entity';
import { MemorizationCertificate } from '../entities/memorization-certificate.entity';
import { MemorizationPlanChange } from '../entities/memorization-plan-change.entity';
import { MemorizationReset } from '../entities/memorization-reset.entity';

const entities = [
  User,
  Group,
  GroupMembership,
  JoinRequest,
  DailyReport,
  WeeklyReport,
  Attendance,
  AbsenceExcuseRequest,
  StudentRequest,
  StudentNote,
  Infraction,
  InfractionPolicy,
  StudentQuota,
  NotificationStub,
  ProgramContent,
  ReportDeadlineConfig,
  AuditLog,
  DeviceToken,
  MemorizationPlan,
  MemorizationProgress,
  MemorizationProgressHistory,
  MemorizationHizbCompletion,
  MemorizationAchievement,
  MemorizationAssessment,
  MemorizationCertificate,
  MemorizationPlanChange,
  MemorizationReset,
];

@Module({
  imports: [TypeOrmModule.forFeature(entities)],
  controllers: [
    GroupsController,
    ReportsController,
    AttendanceController,
    PoliciesController,
    NotificationsController,
    DashboardsController,
    StudentRequestsController,
    MemorizationController,
  ],
  providers: [
    DomainContext,
    GroupsService,
    ReportsService,
    StudentRequestsService,
    MemorizationService,
    AttendanceService,
    PoliciesService,
    NotificationsService,
    DashboardsService,
    DomainService,
    PushService,
    ReminderService,
  ],
  exports: [
    DomainService,
    GroupsService,
    ReportsService,
    AttendanceService,
    StudentRequestsService,
    MemorizationService,
    PoliciesService,
    NotificationsService,
    DashboardsService,
    PushService,
    TypeOrmModule,
  ],
})
export class DomainModule {}

export { entities };
