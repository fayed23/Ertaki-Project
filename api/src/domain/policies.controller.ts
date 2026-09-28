import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { DomainService } from './domain.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { User } from '../entities/user.entity';
import { InfractionAction, InfractionType, UserRole } from '../common/enums';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class PoliciesController {
  constructor(private readonly domain: DomainService) {}

  @Get('infractions')
  listInfractions(
    @CurrentUser() user: User,
    @Query('studentId') studentId?: string,
  ) {
    return this.domain.listInfractions(user, studentId);
  }
  @Get('infraction-policies')
  @Roles(UserRole.SUPERVISOR, UserRole.ADMIN)
  listPolicies(@CurrentUser() user: User) {
    return this.domain.listPolicies(user);
  }
  @Post('infraction-policies')
  @Roles(UserRole.SUPERVISOR, UserRole.ADMIN)
  upsertPolicy(
    @CurrentUser() user: User,
    @Body()
    body: {
      id?: string;
      infractionType: InfractionType;
      thresholdCount: number;
      action: InfractionAction;
      actionLabel?: string;
      enabled?: boolean;
    },
  ) {
    return this.domain.upsertPolicy(user, body);
  }
  @Post('quotas')
  @Roles(UserRole.TEACHER, UserRole.SUPERVISOR, UserRole.ADMIN)
  setQuota(
    @CurrentUser() user: User,
    @Body()
    body: {
      studentId: string;
      dailyQuotaDescription: string;
      requiredRepetitions?: number;
    },
  ) {
    return this.domain.setQuota(
      user,
      body.studentId,
      body.dailyQuotaDescription,
      body.requiredRepetitions ?? 50,
    );
  }
  @Get('quotas')
  getQuota(@CurrentUser() user: User, @Query('studentId') studentId?: string) {
    return this.domain.getQuota(user, studentId);
  }
  @Get('program-content')
  listContent() {
    return this.domain.listProgramContent();
  }
  @Post('program-content')
  @Roles(UserRole.SUPERVISOR, UserRole.ADMIN)
  upsertContent(
    @CurrentUser() user: User,
    @Body()
    body: { key: string; title: string; body: string; videoUrl?: string },
  ) {
    return this.domain.upsertProgramContent(user, body);
  }
  @Get('report-deadline-config')
  getDeadline() {
    return this.domain.getDeadlineConfig();
  }
  @Post('report-deadline-config')
  @Roles(UserRole.SUPERVISOR, UserRole.ADMIN)
  upsertDeadline(
    @CurrentUser() user: User,
    @Body()
    body: {
      enabled: boolean;
      timezone: string;
      closeTimeLocal: string;
      reminderMinutesBefore?: number;
      notes?: string;
    },
  ) {
    return this.domain.upsertDeadlineConfig(user, body);
  }
}
