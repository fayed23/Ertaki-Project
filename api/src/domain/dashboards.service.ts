import { Injectable, ForbiddenException } from '@nestjs/common';
import { IsNull } from 'typeorm';
import {
  GroupStatus,
  JoinRequestStatus,
  UserRole,
  UserStatus,
} from '../common/enums';
import { User } from '../entities/user.entity';
import { DomainContext } from './domain-context';

@Injectable()
export class DashboardsService {
  constructor(private readonly ctx: DomainContext) {}

  async teacherDashboard(actor: User) {
    if (actor.role !== UserRole.TEACHER && !this.ctx.isSupervisor(actor)) {
      throw new ForbiddenException();
    }
    const groups =
      actor.role === UserRole.TEACHER
        ? await this.ctx.groups.find({ where: { teacherId: actor.id } })
        : await this.ctx.groups.find();
    const today = new Date().toISOString().slice(0, 10);
    const result = [];
    let missingTotal = 0;
    for (const g of groups) {
      const members = await this.ctx.memberships.find({
        where: { groupId: g.id, leftAt: IsNull() },
      });
      const memberIds = members.map((m) => m.userId);
      const submittedToday = memberIds.length
        ? await this.ctx.dailyReports
            .createQueryBuilder('r')
            .where('r.studentId IN (:...memberIds)', { memberIds })
            .andWhere('r.reportDate = :today', { today })
            .getCount()
        : 0;
      const todayReportsRaw = memberIds.length
        ? await this.ctx.dailyReports
            .createQueryBuilder('r')
            .leftJoinAndSelect('r.student', 'student')
            .where('r.studentId IN (:...memberIds)', { memberIds })
            .andWhere('r.reportDate = :today', { today })
            .orderBy('r.submittedAt', 'DESC')
            .getMany()
        : [];
      const todayReports = await Promise.all(
        todayReportsRaw.map((r) => this.ctx.enrichDailyReport(r)),
      );
      const openInfractions = memberIds.length
        ? await this.ctx.infractions
            .createQueryBuilder('i')
            .where('i.studentId IN (:...memberIds)', { memberIds })
            .andWhere('i.resolved = false')
            .getCount()
        : 0;
      const missingToday = Math.max(0, members.length - submittedToday);
      missingTotal += missingToday;
      result.push({
        group: g,
        studentCount: members.length,
        submittedToday,
        missingToday,
        openInfractions,
        todayReports,
        students: members.map((m) => ({
          id: m.user.id,
          name: `${m.user.firstName} ${m.user.lastName}`,
          phone: m.user.phone,
          status: m.user.status,
        })),
      });
    }
    const groupIds = groups.map((g) => g.id);
    const pendingJoins = groupIds.length
      ? await this.ctx.joinRequests
          .createQueryBuilder('j')
          .where('j.groupId IN (:...groupIds)', { groupIds })
          .andWhere('j.status = :st', { st: JoinRequestStatus.PENDING })
          .getCount()
      : 0;
    const unreadNotifications = await this.ctx.unreadNotificationCount(
      actor.id,
    );
    return {
      today,
      groups: result,
      badges: {
        pendingJoins,
        missingTodayReports: missingTotal,
        unreadNotifications,
      },
    };
  }

  async supervisorDashboard(actor: User) {
    this.ctx.requireSupervisor(actor);
    const today = new Date().toISOString().slice(0, 10);
    const [
      students,
      teachers,
      groups,
      pendingJoins,
      pendingAccounts,
      pendingGroupApprovals,
      activeStudents,
      openInfractions,
      unreadNotifications,
    ] = await Promise.all([
      this.ctx.users.count({ where: { role: UserRole.STUDENT } }),
      this.ctx.users.count({ where: { role: UserRole.TEACHER } }),
      this.ctx.groups.count(),
      this.ctx.joinRequests.count({
        where: { status: JoinRequestStatus.PENDING },
      }),
      this.ctx.users.count({ where: { status: UserStatus.PENDING_APPROVAL } }),
      this.ctx.groups.count({
        where: { status: GroupStatus.PENDING_APPROVAL },
      }),
      this.ctx.users.count({
        where: { role: UserRole.STUDENT, status: UserStatus.ACTIVE },
      }),
      this.ctx.infractions.count({ where: { resolved: false } }),
      this.ctx.unreadNotificationCount(actor.id),
    ]);
    return {
      today,
      students,
      teachers,
      groups,
      pendingJoins,
      pendingAccounts,
      pendingGroupApprovals,
      activeStudents,
      openInfractions,
      badges: {
        pendingJoins,
        pendingAccounts,
        pendingGroupApprovals,
        unreadNotifications,
      },
    };
  }
}
