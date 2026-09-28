process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'ci-test-secret-not-for-production-32chars';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.SQLITE_PATH = process.env.SQLITE_PATH || ':memory:';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Ertaki critical rules (e2e)', () => {
  let app: INestApplication;
  let studentToken: string;
  let teacherToken: string;
  let peerToken: string | null = null;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    const login = async (phone: string) => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ phone, password: 'password123' });
      expect(res.status).toBeLessThan(400);
      return res.body.accessToken as string;
    };

    studentToken = await login('0500000003');
    teacherToken = await login('0500000002');

    const peer = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ phone: '0500000004', password: 'password123' });
    if (peer.status < 400) peerToken = peer.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health returns ok with db up', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.db).toBe('up');
  });

  it('daily report is immutable after submit', async () => {
    const reportDate = '2099-01-15';
    const body = {
      reportDate,
      memorizedQuota: true,
      memorizationFrom: '08:00',
      memorizationTo: '09:00',
      memorizationSurahNumber: 1,
      memorizationSurahName: 'الفاتحة',
      memorizationAyahFrom: 1,
      memorizationAyahTo: 7,
      completedFiftyRepetitions: true,
      repeatedInOneSitting: true,
      readTafsir: true,
    };
    const first = await request(app.getHttpServer())
      .post('/api/daily-reports')
      .set('Authorization', `Bearer ${studentToken}`)
      .send(body);
    expect([200, 201]).toContain(first.status);

    const second = await request(app.getHttpServer())
      .post('/api/daily-reports')
      .set('Authorization', `Bearer ${studentToken}`)
      .send(body);
    expect(second.status).toBeGreaterThanOrEqual(400);
  });

  it('student cannot list peer daily reports', async () => {
    if (!peerToken) return;
    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${peerToken}`);
    const peerId = me.body.id as string;

    const res = await request(app.getHttpServer())
      .get(`/api/daily-reports?studentId=${peerId}`)
      .set('Authorization', `Bearer ${studentToken}`);
    if (res.status < 400) {
      const rows = Array.isArray(res.body) ? res.body : [];
      for (const row of rows) {
        expect(row.studentId).not.toBe(peerId);
      }
    } else {
      expect(res.status).toBeGreaterThanOrEqual(400);
    }
  });

  it('teacher can see student reports for their group', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/daily-reports')
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(res.status).toBeLessThan(400);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
