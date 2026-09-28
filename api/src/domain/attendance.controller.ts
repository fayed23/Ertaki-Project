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
import { AttendanceStatus, NoteVisibility, UserRole } from '../common/enums';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly domain: DomainService) {}

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
  listNotes(@CurrentUser() user: User, @Query('studentId') studentId?: string) {
    return this.domain.listNotes(user, studentId);
  }
}
