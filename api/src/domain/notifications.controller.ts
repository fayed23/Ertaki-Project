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
export class NotificationsController {
  constructor(private readonly domain: DomainService) {}

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
}
