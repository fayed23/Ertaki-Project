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
export class ReportsController {
  constructor(private readonly domain: DomainService) {}

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
  ) {
    return this.domain.listDailyReports(user, {
      studentId,
      reportDate,
      groupId,
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
}
