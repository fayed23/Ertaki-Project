import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { DataSource } from 'typeorm';

@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async check() {
    let db: 'up' | 'down' = 'down';
    try {
      await this.dataSource.query('SELECT 1');
      db = 'up';
    } catch {
      db = 'down';
    }
    const ok = db === 'up';
    return {
      status: ok ? 'ok' : 'degraded',
      db,
      ts: new Date().toISOString(),
    };
  }
}
