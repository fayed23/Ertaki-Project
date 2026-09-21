import {
  Body,
  Controller,
  Get,
  Param,
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
import {
  AttendanceStatus,
  InfractionAction,
  InfractionType,
  NoteVisibility,
  UserRole,
} from '../common/enums';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class DomainController {
  constructor(private readonly domain: DomainService) {}

  @Get('users')
  @Roles(UserRole.TEACHER, UserRole.SUPERVISOR, UserRole.ADMIN)
  listUsers(@CurrentUser() user: User) {
    return this.domain.listUsers(user);
  }

  @Get('groups')
  listGroups() {
    return this.domain.listGroups();
  }

  @Get('groups/:id')
  getGroup(@Param('id') id: string) {
    return this.domain.getGroup(id);
  }

  @Post('groups')
  @Roles(UserRole.SUPERVISOR, UserRole.ADMIN)
  createGroup(
    @CurrentUser() user: User,
    @Body()
    body: {
      name: string;
      teacherId: string;
      gender: string;
      seatCount: number;
      weeklySessionDay: string;
      weeklySessionTime: string;
      whatsappUrl?: string;
      description?: string;
    },
  ) {
    return this.domain.createGroup(user, body);
  }

  @Post('join-requests')
  @Roles(UserRole.STUDENT)
  requestJoin(@CurrentUser() user: User, @Body() body: { groupId: string }) {
    return this.domain.requestJoin(user, body.groupId);
  }

  @Get('join-requests')
  @Roles(UserRole.TEACHER, UserRole.SUPERVISOR, UserRole.ADMIN)
  listJoinRequests(@CurrentUser() user: User) {
    return this.domain.listJoinRequests(user);
  }

  @Patch('join-requests/:id')
  @Roles(UserRole.SUPERVISOR, UserRole.ADMIN)
  reviewJoin(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: { accept: boolean; reviewNote?: string },
  ) {
    return this.domain.reviewJoinRequest(user, id, body.accept, body.reviewNote);
  }

  @Get('memberships/me')
  myMembership(@CurrentUser() user: User) {
    return this.domain.myMembership(user);
  }

  @Get('memberships')
  membershipHistory(
    @CurrentUser() user: User,
    @Query('studentId') studentId?: string,
  ) {
    return this.domain.membershipHistory(user, studentId);
  }

  @Post('memberships/change-group')
  @Roles(UserRole.SUPERVISOR, UserRole.ADMIN)
  changeGroup(
    @CurrentUser() user: User,
    @Body() body: { studentId: string; newGroupId: string; reason?: string },
  ) {
    return this.domain.changeGroup(
      user,
      body.studentId,
      body.newGroupId,
      body.reason,
    );
  }

  @Post('daily-reports')
  @Roles(UserRole.STUDENT)
  submitDaily(
    @CurrentUser() user: User,
    @Body()
    body: {
      reportDate: string;
      memorizedQuota: boolean;
      memorizationFrom?: string;
      memorizationTo?: string;
      reviewPortion?: string;
      reviewFrom?: string;
      reviewTo?: string;
      completedFiftyRepetitions: boolean;
      repeatedInOneSitting: boolean;
      readTafsir: boolean;
    },
  ) {
    return this.domain.submitDailyReport(user, body);
  }

  @Get('daily-reports')
  listDaily(
    @CurrentUser() user: User,
    @Query('studentId') studentId?: string,
    @Query('reportDate') reportDate?: string,
    @Query('groupId') groupId?: string,
  ) {
    return this.domain.listDailyReports(user, {
      studentId,
      reportDate,
      groupId,
    });
  }

  @Post('weekly-reports/generate')
  @Roles(UserRole.TEACHER, UserRole.SUPERVISOR, UserRole.ADMIN)
  generateWeekly(
    @CurrentUser() user: User,
    @Body()
    body: { studentId: string; weekStartDate: string; weekEndDate: string },
  ) {
    return this.domain.generateWeeklyReport(
      user,
      body.studentId,
      body.weekStartDate,
      body.weekEndDate,
    );
  }

  @Patch('weekly-reports/:id/confirm')
  confirmWeekly(@CurrentUser() user: User, @Param('id') id: string) {
    return this.domain.confirmWeeklyReport(user, id);
  }

  @Get('weekly-reports')
  listWeekly(
    @CurrentUser() user: User,
    @Query('studentId') studentId?: string,
  ) {
    return this.domain.listWeeklyReports(user, studentId);
  }

  @Post('attendance')
  @Roles(UserRole.TEACHER, UserRole.SUPERVISOR, UserRole.ADMIN)
  recordAttendance(
    @CurrentUser() user: User,
    @Body()
    body: {
      studentId: string;
      groupId: string;
      sessionDate: string;
      status: AttendanceStatus;
      arrivedLate?: boolean;
      leftEarly?: boolean;
      note?: string;
    },
  ) {
    return this.domain.recordAttendance(user, body);
  }

  @Get('attendance')
  @Roles(UserRole.TEACHER, UserRole.SUPERVISOR, UserRole.ADMIN)
  listAttendance(
    @CurrentUser() user: User,
    @Query('groupId') groupId?: string,
    @Query('sessionDate') sessionDate?: string,
  ) {
    return this.domain.listAttendance(user, groupId, sessionDate);
  }

  @Post('excuse-requests')
  @Roles(UserRole.STUDENT)
  requestExcuse(
    @CurrentUser() user: User,
    @Body() body: { groupId: string; sessionDate: string; reason: string },
  ) {
    return this.domain.requestExcuse(user, body);
  }

  @Get('excuse-requests')
  listExcuses(@CurrentUser() user: User) {
    return this.domain.listExcuses(user);
  }

  @Patch('excuse-requests/:id')
  @Roles(UserRole.TEACHER, UserRole.SUPERVISOR, UserRole.ADMIN)
  reviewExcuse(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: { approve: boolean },
  ) {
    return this.domain.reviewExcuse(user, id, body.approve);
  }

  @Post('notes')
  @Roles(UserRole.TEACHER, UserRole.SUPERVISOR, UserRole.ADMIN)
  addNote(
    @CurrentUser() user: User,
    @Body()
    body: {
      studentId: string;
      body: string;
      visibility: NoteVisibility;
      noteDate: string;
    },
  ) {
    return this.domain.addNote(user, body);
  }

  @Get('notes')
  listNotes(
    @CurrentUser() user: User,
    @Query('studentId') studentId?: string,
  ) {
    return this.domain.listNotes(user, studentId);
  }

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
  getQuota(
    @CurrentUser() user: User,
    @Query('studentId') studentId?: string,
  ) {
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
      notes?: string;
    },
  ) {
    return this.domain.upsertDeadlineConfig(user, body);
  }

  @Get('notifications')
  myNotifications(@CurrentUser() user: User) {
    return this.domain.myNotifications(user);
  }

  @Get('dashboards/teacher')
  @Roles(UserRole.TEACHER, UserRole.SUPERVISOR, UserRole.ADMIN)
  teacherDashboard(@CurrentUser() user: User) {
    return this.domain.teacherDashboard(user);
  }

  @Get('dashboards/supervisor')
  @Roles(UserRole.SUPERVISOR, UserRole.ADMIN)
  supervisorDashboard(@CurrentUser() user: User) {
    return this.domain.supervisorDashboard(user);
  }
}
