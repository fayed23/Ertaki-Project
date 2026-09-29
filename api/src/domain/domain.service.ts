import { Injectable } from '@nestjs/common';
import { User } from '../entities/user.entity';
import { Group } from '../entities/group.entity';
import { GroupsService } from './groups.service';
import { ReportsService } from './reports.service';
import { AttendanceService } from './attendance.service';
import { PoliciesService } from './policies.service';
import { NotificationsService } from './notifications.service';
import { DashboardsService } from './dashboards.service';
import {
  StudentRequestsService,
  StudentRequestFilters,
} from './student-requests.service';
import { MemorizationService } from './memorization.service';
import { NoteVisibility } from '../common/enums';
import { AttendanceStatus } from '../common/enums';
import { InfractionAction, InfractionType } from '../common/enums';
import { StudentRequestType } from '../common/enums';

/**
 * Facade over split domain services — keeps ReminderService and legacy call sites stable.
 */
@Injectable()
export class DomainService {
  constructor(
    private readonly groups: GroupsService,
    private readonly reports: ReportsService,
    private readonly attendance: AttendanceService,
    private readonly policies: PoliciesService,
    private readonly notifications: NotificationsService,
    private readonly dashboards: DashboardsService,
    private readonly studentRequests: StudentRequestsService,
    private readonly memorization: MemorizationService,
  ) {}

  registerDeviceToken(actor: User, token: string, platform?: string) {
    return this.notifications.registerDeviceToken(actor, token, platform);
  }
  unregisterDeviceToken(actor: User, token: string) {
    return this.notifications.unregisterDeviceToken(actor, token);
  }
  listUsers(actor: User) {
    return this.groups.listUsers(actor);
  }
  listPendingAccounts(actor: User) {
    return this.groups.listPendingAccounts(actor);
  }
  reviewAccount(
    actor: User,
    userId: string,
    approve: boolean,
    reviewNote?: string,
  ) {
    return this.groups.reviewAccount(actor, userId, approve, reviewNote);
  }
  createGroup(actor: User, input: Parameters<GroupsService['createGroup']>[1]) {
    return this.groups.createGroup(actor, input);
  }
  reviewGroupCreation(
    actor: User,
    id: string,
    approve: boolean,
    reviewNote?: string,
  ) {
    return this.groups.reviewGroupCreation(actor, id, approve, reviewNote);
  }
  updateGroup(
    actor: User,
    id: string,
    input: Parameters<GroupsService['updateGroup']>[2],
  ) {
    return this.groups.updateGroup(actor, id, input);
  }
  listGroups(actor?: User) {
    return this.groups.listGroups(actor);
  }
  getGroup(id: string) {
    return this.groups.getGroup(id);
  }
  getGroupForActor(actor: User, id: string) {
    return this.groups.getGroupForActor(actor, id);
  }
  getGroupBrief(actor: User, id: string) {
    return this.groups.getGroupBrief(actor, id);
  }
  getGroupDetailed(actor: User, id: string) {
    return this.groups.getGroupDetailed(actor, id);
  }
  enrichGroup(group: Group) {
    return this.groups.enrichGroup(group);
  }
  requestJoin(actor: User, groupId: string) {
    return this.groups.requestJoin(actor, groupId);
  }
  cancelJoinRequest(actor: User, id: string) {
    return this.groups.cancelJoinRequest(actor, id);
  }
  listJoinRequests(actor: User) {
    return this.groups.listJoinRequests(actor);
  }
  reviewJoinRequest(
    actor: User,
    id: string,
    accept: boolean,
    reviewNote?: string,
  ) {
    return this.groups.reviewJoinRequest(actor, id, accept, reviewNote);
  }
  studentHasMembership(actor: User) {
    return this.groups.studentHasMembership(actor);
  }
  listDirectory(actor: User) {
    return this.groups.listDirectory(actor);
  }
  myMembership(actor: User) {
    return this.groups.myMembership(actor);
  }
  membershipHistory(actor: User, studentId?: string) {
    return this.groups.membershipHistory(actor, studentId);
  }
  changeGroup(
    actor: User,
    studentId: string,
    newGroupId: string,
    reason?: string,
  ) {
    return this.groups.changeGroup(actor, studentId, newGroupId, reason);
  }
  submitDailyReport(
    actor: User,
    body: Parameters<ReportsService['submitDailyReport']>[1],
  ) {
    return this.reports.submitDailyReport(actor, body);
  }
  listDailyReports(
    actor: User,
    q: Parameters<ReportsService['listDailyReports']>[1],
  ) {
    return this.reports.listDailyReports(actor, q);
  }
  getDailyReport(actor: User, id: string) {
    return this.reports.getDailyReport(actor, id);
  }
  generateWeeklyReport(
    actor: User,
    studentId: string,
    weekStartDate: string,
    weekEndDate: string,
  ) {
    return this.reports.generateWeeklyReport(
      actor,
      studentId,
      weekStartDate,
      weekEndDate,
    );
  }
  autoGenerateWeeklyReports(timezone?: string) {
    return this.reports.autoGenerateWeeklyReports(timezone);
  }
  confirmWeeklyReport(actor: User, id: string) {
    return this.reports.confirmWeeklyReport(actor, id);
  }
  listWeeklyReports(
    actor: User,
    studentId?: string,
    mode?: 'brief' | 'detailed',
  ) {
    return this.reports.listWeeklyReports(actor, studentId, mode);
  }
  getWeeklyReport(actor: User, id: string, mode?: 'brief' | 'detailed') {
    return this.reports.getWeeklyReport(actor, id, mode);
  }
  recordAttendance(
    actor: User,
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
    return this.attendance.recordAttendance(actor, body);
  }
  listAttendance(actor: User, groupId?: string, sessionDate?: string) {
    return this.attendance.listAttendance(actor, groupId, sessionDate);
  }
  requestExcuse(
    actor: User,
    body: { groupId: string; sessionDate: string; reason: string },
  ) {
    return this.attendance.requestExcuse(actor, body);
  }
  reviewExcuse(actor: User, id: string, approve: boolean) {
    return this.attendance.reviewExcuse(actor, id, approve);
  }
  listExcuses(actor: User) {
    return this.attendance.listExcuses(actor);
  }
  createStudentRequest(
    actor: User,
    body: {
      type: StudentRequestType;
      relevantDate: string;
      reason: string;
      groupId?: string;
    },
    file?: Express.Multer.File,
  ) {
    return this.studentRequests.create(actor, body, file);
  }
  listStudentRequests(actor: User, filters?: StudentRequestFilters) {
    return this.studentRequests.list(actor, filters);
  }
  studentRequestStats(actor: User) {
    return this.studentRequests.stats(actor);
  }
  getStudentRequest(actor: User, id: string) {
    return this.studentRequests.getOne(actor, id);
  }
  cancelStudentRequest(actor: User, id: string) {
    return this.studentRequests.cancel(actor, id);
  }
  reviewStudentRequest(
    actor: User,
    id: string,
    body: { approve: boolean; reviewerNote?: string },
  ) {
    return this.studentRequests.review(actor, id, body);
  }
  openStudentRequestAttachment(actor: User, id: string) {
    return this.studentRequests.openAttachment(actor, id);
  }
  getMemorizationSnapshot(actor: User, studentId?: string) {
    return this.memorization.getSnapshot(actor, studentId);
  }
  setupMemorization(
    actor: User,
    body: Parameters<MemorizationService['setup']>[1],
  ) {
    return this.memorization.setup(actor, body);
  }
  editMemorizationPlan(
    actor: User,
    body: Parameters<MemorizationService['editPlan']>[1],
  ) {
    return this.memorization.editPlan(actor, body);
  }
  resetMemorizationProgress(
    actor: User,
    body: Parameters<MemorizationService['resetProgress']>[1],
  ) {
    return this.memorization.resetProgress(actor, body);
  }
  completeMemorizationHizb(
    actor: User,
    body: Parameters<MemorizationService['completeHizb']>[1],
  ) {
    return this.memorization.completeHizb(actor, body);
  }
  upsertMemorizationAssessment(
    actor: User,
    body: Parameters<MemorizationService['upsertAssessment']>[1],
  ) {
    return this.memorization.upsertAssessment(actor, body);
  }
  issueMemorizationCertificate(
    actor: User,
    body: Parameters<MemorizationService['issueCertificate']>[1],
  ) {
    return this.memorization.issueCertificate(actor, body);
  }
  addNote(
    actor: User,
    body: {
      studentId: string;
      body: string;
      visibility: NoteVisibility;
      noteDate: string;
    },
  ) {
    return this.attendance.addNote(actor, body);
  }
  listNotes(actor: User, studentId?: string) {
    return this.attendance.listNotes(actor, studentId);
  }
  saveWeeklyAttendance(
    actor: User,
    body: Parameters<AttendanceService['saveWeeklyAttendance']>[1],
  ) {
    return this.attendance.saveWeeklyAttendance(actor, body);
  }
  listInfractions(actor: User, studentId?: string) {
    return this.policies.listInfractions(actor, studentId);
  }
  listPolicies(actor: User) {
    return this.policies.listPolicies(actor);
  }
  upsertPolicy(
    actor: User,
    body: {
      id?: string;
      infractionType: InfractionType;
      thresholdCount: number;
      action: InfractionAction;
      actionLabel?: string;
      enabled?: boolean;
    },
  ) {
    return this.policies.upsertPolicy(actor, body);
  }
  setQuota(
    actor: User,
    studentId: string,
    dailyQuotaDescription: string,
    requiredRepetitions: number,
  ) {
    return this.policies.setQuota(
      actor,
      studentId,
      dailyQuotaDescription,
      requiredRepetitions,
    );
  }
  getQuota(actor: User, studentId?: string) {
    return this.policies.getQuota(actor, studentId);
  }
  listProgramContent() {
    return this.policies.listProgramContent();
  }
  upsertProgramContent(
    actor: User,
    body: { key: string; title: string; body: string; videoUrl?: string },
  ) {
    return this.policies.upsertProgramContent(actor, body);
  }
  getDeadlineConfig() {
    return this.policies.getDeadlineConfig();
  }
  upsertDeadlineConfig(
    actor: User,
    body: Parameters<PoliciesService['upsertDeadlineConfig']>[1],
  ) {
    return this.policies.upsertDeadlineConfig(actor, body);
  }
  myNotifications(actor: User) {
    return this.notifications.myNotifications(actor);
  }
  markNotificationsRead(actor: User, ids?: string[]) {
    return this.notifications.markNotificationsRead(actor, ids);
  }
  clearNotifications(actor: User) {
    return this.notifications.clearNotifications(actor);
  }
  teacherDashboard(actor: User) {
    return this.dashboards.teacherDashboard(actor);
  }
  supervisorDashboard(actor: User) {
    return this.dashboards.supervisorDashboard(actor);
  }
}
