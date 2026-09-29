import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DomainService } from './domain.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { User } from '../entities/user.entity';
import { UserRole } from '../common/enums';

@Controller('memorization')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MemorizationController {
  constructor(private readonly domain: DomainService) {}

  @Get()
  @Roles(
    UserRole.STUDENT,
    UserRole.TEACHER,
    UserRole.SUPERVISOR,
    UserRole.ADMIN,
  )
  snapshot(
    @CurrentUser() user: User,
    @Query('studentId') studentId?: string,
  ) {
    return this.domain.getMemorizationSnapshot(user, studentId);
  }

  @Post('setup')
  @Roles(
    UserRole.STUDENT,
    UserRole.TEACHER,
    UserRole.SUPERVISOR,
    UserRole.ADMIN,
  )
  setup(
    @CurrentUser() user: User,
    @Body()
    body: {
      studentId?: string;
      startSurahNumber: number;
      startAyah: number;
      pace: string;
      confirmNew?: boolean;
      confirmSequential?: boolean;
      reason?: string;
    },
  ) {
    return this.domain.setupMemorization(user, body);
  }

  @Patch('plan')
  @Roles(
    UserRole.STUDENT,
    UserRole.TEACHER,
    UserRole.SUPERVISOR,
    UserRole.ADMIN,
  )
  editPlan(
    @CurrentUser() user: User,
    @Body()
    body: {
      studentId?: string;
      startSurahNumber?: number;
      startAyah?: number;
      pace?: string;
      reason: string;
      confirmMode?: 'plan_only' | 'plan_and_reset';
    },
  ) {
    return this.domain.editMemorizationPlan(user, body);
  }

  @Post('reset')
  @Roles(UserRole.SUPERVISOR, UserRole.ADMIN)
  reset(
    @CurrentUser() user: User,
    @Body() body: { studentId: string; reason: string; confirm?: boolean },
  ) {
    return this.domain.resetMemorizationProgress(user, body);
  }

  @Post('hizb-completions')
  @Roles(
    UserRole.STUDENT,
    UserRole.TEACHER,
    UserRole.SUPERVISOR,
    UserRole.ADMIN,
  )
  completeHizb(
    @CurrentUser() user: User,
    @Body() body: { studentId?: string; hizbNumber: number },
  ) {
    return this.domain.completeMemorizationHizb(user, body);
  }

  @Post('assessments')
  @Roles(UserRole.TEACHER, UserRole.SUPERVISOR, UserRole.ADMIN)
  upsertAssessment(
    @CurrentUser() user: User,
    @Body()
    body: {
      studentId: string;
      cycleNumber?: number;
      status?: string;
      notes?: string;
      scheduledAt?: string;
      assessmentId?: string;
    },
  ) {
    return this.domain.upsertMemorizationAssessment(user, body);
  }

  @Post('certificates')
  @Roles(UserRole.TEACHER, UserRole.SUPERVISOR, UserRole.ADMIN)
  issueCertificate(
    @CurrentUser() user: User,
    @Body()
    body: {
      studentId: string;
      cycleNumber: number;
      assessmentId?: string;
      title?: string;
    },
  ) {
    return this.domain.issueMemorizationCertificate(user, body);
  }
}
