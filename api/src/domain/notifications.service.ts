import { Injectable } from '@nestjs/common';
import { User } from '../entities/user.entity';
import { DomainContext } from './domain-context';

@Injectable()
export class NotificationsService {
  constructor(private readonly ctx: DomainContext) {}

  registerDeviceToken(actor: User, token: string, platform?: string) {
    return this.ctx.push.registerToken(actor.id, token, platform || 'fcm');
  }

  unregisterDeviceToken(actor: User, token: string) {
    return this.ctx.push.unregisterToken(actor.id, token);
  }

  myNotifications(actor: User) {
    return this.ctx.notifications.find({
      where: { recipientId: actor.id },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async markNotificationsRead(actor: User, ids?: string[]) {
    const qb = this.ctx.notifications
      .createQueryBuilder()
      .update()
      .set({ readAt: new Date() })
      .where('recipientId = :rid', { rid: actor.id })
      .andWhere('readAt IS NULL');
    if (ids?.length) {
      qb.andWhere('id IN (:...ids)', { ids });
    }
    const result = await qb.execute();
    return { marked: result.affected ?? 0 };
  }

  async clearNotifications(actor: User) {
    const result = await this.ctx.notifications.delete({
      recipientId: actor.id,
    });
    return { cleared: result.affected ?? 0 };
  }
}
