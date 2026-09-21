import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedService } from './seed.service';
import { User } from '../entities/user.entity';
import { Group } from '../entities/group.entity';
import { InfractionPolicy } from '../entities/infraction-policy.entity';
import { ProgramContent } from '../entities/program-content.entity';
import { ReportDeadlineConfig } from '../entities/report-deadline-config.entity';
import { StudentQuota } from '../entities/student-quota.entity';
import { GroupMembership } from '../entities/group-membership.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Group,
      InfractionPolicy,
      ProgramContent,
      ReportDeadlineConfig,
      StudentQuota,
      GroupMembership,
    ]),
  ],
  providers: [SeedService],
})
export class SeedModule {}
