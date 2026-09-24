import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceToken } from '../entities/device-token.entity';
import { NotificationStub } from '../entities/notification-stub.entity';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    @InjectRepository(NotificationStub)
    private readonly notifications: Repository<NotificationStub>,
    @InjectRepository(DeviceToken)
    private readonly tokens: Repository<DeviceToken>,
  ) {}

  async notify(
    recipientId: string,
    type: string,
    title: string,
    body: string,
    payload?: Record<string, unknown>,
  ) {
    const row = await this.notifications.save(
      this.notifications.create({
        recipientId,
        type,
        title,
        body,
        payload: payload ?? null,
        delivered: false,
        readAt: null,
      }),
    );

    const devices = await this.tokens.find({ where: { userId: recipientId } });
    if (!devices.length) return row;

    const serverKey = process.env.FCM_SERVER_KEY;
    if (!serverKey) {
      this.logger.debug(
        `FCM_SERVER_KEY unset — stored in-app notification ${row.id} for ${recipientId}`,
      );
      return row;
    }

    let delivered = false;
    for (const device of devices) {
      try {
        const ok = await this.sendFcm(serverKey, device.token, title, body, {
          type,
          notificationId: row.id,
          ...(payload ?? {}),
        });
        if (ok) delivered = true;
      } catch (e) {
        this.logger.warn(`FCM send failed: ${(e as Error).message}`);
      }
    }
    if (delivered) {
      row.delivered = true;
      await this.notifications.save(row);
    }
    return row;
  }

  async registerToken(userId: string, token: string, platform = 'fcm') {
    const existing = await this.tokens.findOne({ where: { token } });
    if (existing) {
      existing.userId = userId;
      existing.platform = platform;
      return this.tokens.save(existing);
    }
    return this.tokens.save(
      this.tokens.create({ userId, token, platform }),
    );
  }

  async unregisterToken(userId: string, token: string) {
    await this.tokens.delete({ userId, token });
    return { ok: true };
  }

  private async sendFcm(
    serverKey: string,
    to: string,
    title: string,
    body: string,
    data: Record<string, unknown>,
  ): Promise<boolean> {
    const res = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        Authorization: `key=${serverKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to,
        notification: { title, body, sound: 'default' },
        data: Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, String(v)]),
        ),
        priority: 'high',
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      this.logger.warn(`FCM HTTP ${res.status}: ${text.slice(0, 200)}`);
      return false;
    }
    return true;
  }
}
