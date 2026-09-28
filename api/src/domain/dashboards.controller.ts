import { Controller, Get, UseGuards } from '@nestjs/common';
import { DomainService } from './domain.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { User } from '../entities/user.entity';
import { UserRole } from '../common/enums';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardsController {
  constructor(private readonly domain: DomainService) {}

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
