import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { DomainService } from './domain.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { User } from '../entities/user.entity';
import { StudentRequestType, UserRole } from '../common/enums';
import { STUDENT_REQUEST_MAX_BYTES } from './student-request-upload';

@Controller('student-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentRequestsController {
  constructor(private readonly domain: DomainService) {}

  @Post()
  @Roles(UserRole.STUDENT)
  @UseInterceptors(
    FileInterceptor('attachment', {
      storage: memoryStorage(),
      limits: { fileSize: STUDENT_REQUEST_MAX_BYTES },
    }),
  )
  create(
    @CurrentUser() user: User,
    @Body()
    body: {
      type: StudentRequestType;
      relevantDate: string;
      reason: string;
      groupId?: string;
    },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.domain.createStudentRequest(user, body, file);
  }

  @Get()
  list(
    @CurrentUser() user: User,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('studentId') studentId?: string,
    @Query('groupId') groupId?: string,
    @Query('teacherId') teacherId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.domain.listStudentRequests(user, {
      status,
      type,
      studentId,
      groupId,
      teacherId,
      from,
      to,
    });
  }

  @Get('stats')
  @Roles(UserRole.SUPERVISOR, UserRole.ADMIN)
  stats(@CurrentUser() user: User) {
    return this.domain.studentRequestStats(user);
  }

  @Get(':id')
  getOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.domain.getStudentRequest(user, id);
  }

  @Get(':id/attachment')
  async attachment(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const file = await this.domain.openStudentRequestAttachment(user, id);
    res.setHeader('Content-Type', file.mime);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(file.filename)}"`,
    );
    file.stream.pipe(res);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.STUDENT)
  cancel(@CurrentUser() user: User, @Param('id') id: string) {
    return this.domain.cancelStudentRequest(user, id);
  }

  @Patch(':id/review')
  @Roles(UserRole.TEACHER, UserRole.SUPERVISOR, UserRole.ADMIN)
  review(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: { approve: boolean; reviewerNote?: string },
  ) {
    return this.domain.reviewStudentRequest(user, id, body);
  }
}
