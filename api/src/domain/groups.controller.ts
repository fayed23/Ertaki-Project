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
import { Throttle } from '@nestjs/throttler';
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
export class GroupsController {
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
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
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
}
