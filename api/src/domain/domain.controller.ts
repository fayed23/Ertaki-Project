import {
  Body,
  Controller,
  Delete,
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

  @Get('directory')
  @Roles(UserRole.SUPERVISOR, UserRole.ADMIN)
  directory(@CurrentUser() user: User) {
    return this.domain.listDirectory(user);
  }

  @Get('groups')
  listGroups(@CurrentUser() user: User) {
    return this.domain.listGroups(user);
  }

  @Get('groups/:id')
  async getGroup(@Param('id') id: string) {
    return this.domain.enrichGroup(await this.domain.getGroup(id));
  }

  @Get('groups/:id/brief')
  @Roles(UserRole.TEACHER, UserRole.SUPERVISOR, UserRole.ADMIN)
  groupBrief(@CurrentUser() user: User, @Param('id') id: string) {
    return this.domain.getGroupBrief(user, id);
  }

  @Get('groups/:id/detailed')
  @Roles(UserRole.TEACHER, UserRole.SUPERVISOR, UserRole.ADMIN)
  groupDetailed(@CurrentUser() user: User, @Param('id') id: string) {
    return this.domain.getGroupDetailed(user, id);
  }

  @Post('groups')
  @Roles(UserRole.TEACHER, UserRole.SUPERVISOR, UserRole.ADMIN)
  createGroup(
    @CurrentUser() user: User,
    @Body()
    body: {
      name: string;
      teacherId?: string;
      gender: string;
      seatCount?: number;
      weeklySessionDay?: string;
      weeklySessionTime?: string;
      sessionStartTime?: string;
      sessionEndTime?: string;
      whatsappUrl?: string;
      description?: string;
    },
  ) {
    return this.domain.createGroup(user, body);
  }

  @Patch('groups/:id/approval')
  @Roles(UserRole.SUPERVISOR, UserRole.ADMIN)
  reviewGroupCreation(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: { approve: boolean; reviewNote?: string },
  ) {
    return this.domain.reviewGroupCreation(
      user,
      id,
      body.approve,
      body.reviewNote,
    );
  }

  @Patch('groups/:id')
  @Roles(UserRole.TEACHER, UserRole.SUPERVISOR, UserRole.ADMIN)
  updateGroup(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      gender?: string;
      seatCount?: number;
      weeklySessionDay?: string;
      weeklySessionTime?: string;
      sessionStartTime?: string;
      sessionEndTime?: string;
      whatsappUrl?: string | null;
      description?: string | null;
    },
  ) {
    return this.domain.updateGroup(user, id, body);
  }

  @Post('join-requests')
  @Roles(UserRole.STUDENT)
  requestJoin(@CurrentUser() user: User, @Body() body: { groupId: string }) {
    return this.domain.requestJoin(user, body.groupId);
  }

  @Patch('join-requests/:id/cancel')
  @Roles(UserRole.STUDENT)
  cancelJoin(@CurrentUser() user: User, @Param('id') id: string) {
    return this.domain.cancelJoinRequest(user, id);
  }

  @Get('join-requests')
  listJoinRequests(@CurrentUser() user: User) {
    return this.domain.listJoinRequests(user);
  }

  @Patch('join-requests/:id')
  @Roles(UserRole.TEACHER, UserRole.SUPERVISOR, UserRole.ADMIN)
  reviewJoin(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: { accept: boolean; reviewNote?: string },
  ) {
    return this.domain.reviewJoinRequest(user, id, body.accept, body.reviewNote);
  }

  @Get('account-approvals')
  @Roles(UserRole.SUPERVISOR, UserRole.ADMIN)
  listAccountApprovals(@CurrentUser() user: User) {
    return this.domain.listPendingAccounts(user);
  }

  @Patch('account-approvals/:id')
  @Roles(UserRole.SUPERVISOR, UserRole.ADMIN)
  reviewAccount(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: { approve: boolean; reviewNote?: string },
  ) {
    return this.domain.reviewAccount(user, id, body.approve, body.reviewNote);
  }

  @Get('memberships/me')
  myMembership(@CurrentUser() user: User) {
    return this.domain.myMembership(user);
  }

  @Get('memberships/has-group')
  hasGroup(@CurrentUser() user: User) {
    return this.domain.studentHasMembership(user);
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
    return this.domain.submitDailyReport(user, body);
  }

  @Get('daily-reports')
  listDaily(
    @CurrentUser() user: User,
    @Query('studentId') studentId?: string,
    @Query('reportDate') reportDate?: string,
    @Query('groupId') groupId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.domain.listDailyReports(user, {
      studentId,
      reportDate,
      groupId,
      from,
      to,
    });
  }

  @Get('daily-reports/:id')
  getDaily(@CurrentUser() user: User, @Param('id') id: string) {
    return this.domain.getDailyReport(user, id);
  }

  @Post('weekly-reports/generate')
  @Roles(UserRole.TEACHER)
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

  @Post('weekly-reports/auto-generate')
  @Roles(UserRole.TEACHER)
  autoWeekly() {
    return this.domain.autoGenerateWeeklyReports();
  }

  @Patch('weekly-reports/:id/confirm')
  confirmWeekly(@CurrentUser() user: User, @Param('id') id: string) {
    return this.domain.confirmWeeklyReport(user, id);
  }

  @Get('weekly-reports')
  listWeekly(
    @CurrentUser() user: User,
    @Query('studentId') studentId?: string,
    @Query('mode') mode?: 'brief' | 'detailed',
  ) {
    return this.domain.listWeeklyReports(user, studentId, mode ?? 'brief');
  }

  @Get('weekly-reports/:id')
  getWeekly(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('mode') mode?: 'brief' | 'detailed',
  ) {
    return this.domain.getWeeklyReport(user, id, mode ?? 'detailed');
  }

  @Post('trimestrial-reports/generate')
  @Roles(UserRole.TEACHER, UserRole.SUPERVISOR, UserRole.ADMIN)
  generateTrimestrial(
    @CurrentUser() user: User,
    @Body() body: { periodStartDate?: string; periodEndDate?: string },
  ) {
    return this.domain.generateTrimestrialReports(
      user,
      body.periodStartDate,
      body.periodEndDate,
    );
  }

  @Post('trimestrial-reports/auto-generate')
  @Roles(UserRole.TEACHER, UserRole.SUPERVISOR, UserRole.ADMIN)
  autoTrimestrial() {
    return this.domain.autoGenerateTrimestrialReports();
  }

  @Get('trimestrial-reports')
  @Roles(UserRole.TEACHER, UserRole.SUPERVISOR, UserRole.ADMIN)
  listTrimestrial(
    @CurrentUser() user: User,
    @Query('groupId') groupId?: string,
  ) {
    return this.domain.listTrimestrialReports(user, groupId);
  }

  @Get('trimestrial-reports/:id')
  @Roles(UserRole.TEACHER, UserRole.SUPERVISOR, UserRole.ADMIN)
  getTrimestrial(@CurrentUser() user: User, @Param('id') id: string) {
    return this.domain.getTrimestrialReport(user, id);
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

  /** Teacher: save weekly مجلس attendance then generate/update PDF-format weekly reports. */
  @Post('attendance/weekly')
  @Roles(UserRole.TEACHER)
  saveWeeklyAttendance(
    @CurrentUser() user: User,
    @Body()
    body: {
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
    return this.domain.saveWeeklyAttendance(user, body);
  }

  @Get('attendance')
  @Roles(UserRole.TEACHER, UserRole.SUPERVISOR, UserRole.ADMIN)
  listAttendance(
    @CurrentUser() user: User,
    @Query('groupId') groupId?: string,
    @Query('sessionDate') sessionDate?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.domain.listAttendance(user, groupId, sessionDate, from, to);
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
      reminderMinutesBefore?: number;
      notes?: string;
    },
  ) {
    return this.domain.upsertDeadlineConfig(user, body);
  }

  @Get('notifications')
  myNotifications(@CurrentUser() user: User) {
    return this.domain.myNotifications(user);
  }

  @Post('notifications/mark-read')
  markNotificationsRead(
    @CurrentUser() user: User,
    @Body() body: { ids?: string[] },
  ) {
    return this.domain.markNotificationsRead(user, body.ids);
  }

  @Post('notifications/clear')
  clearNotifications(@CurrentUser() user: User) {
    return this.domain.clearNotifications(user);
  }

  @Delete('notifications/:id')
  deleteNotification(@CurrentUser() user: User, @Param('id') id: string) {
    return this.domain.deleteNotification(user, id);
  }

  @Post('device-tokens')
  registerDevice(
    @CurrentUser() user: User,
    @Body() body: { token: string; platform?: string },
  ) {
    return this.domain.registerDeviceToken(user, body.token, body.platform);
  }

  @Post('device-tokens/unregister')
  unregisterDevice(
    @CurrentUser() user: User,
    @Body() body: { token: string },
  ) {
    return this.domain.unregisterDeviceToken(user, body.token);
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
