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
  let supervisorToken: string;
  let peerToken: string | null = null;
  let studentId: string;

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
      return res.body as { accessToken: string; user: { id: string } };
    };

    const student = await login('0500000003');
    studentToken = student.accessToken;
    studentId = student.user.id;
    teacherToken = (await login('0500000002')).accessToken;
    supervisorToken = (await login('0500000001')).accessToken;

    const peer = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ phone: '0500000004', password: 'password123' });
    if (peer.status < 400) peerToken = peer.body.accessToken;
  }, 30000);

  afterAll(async () => {
    if (app) await app.close();
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
    expect(peerToken).toBeTruthy();
    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${peerToken}`);
    const peerId = me.body.id as string;

    const res = await request(app.getHttpServer())
      .get(`/api/daily-reports?studentId=${peerId}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('teacher can see student reports for their group', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/daily-reports')
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(res.status).toBeLessThan(400);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(
      res.body.some((r: { studentId: string }) => r.studentId === studentId),
    ).toBe(true);
  });

  it('infraction policies require supervisor and persist threshold', async () => {
    const denied = await request(app.getHttpServer())
      .post('/api/infraction-policies')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        infractionType: 'missed_daily_report',
        thresholdCount: 3,
        action: 'warn',
        actionLabel: 'تنبيه',
      });
    expect(denied.status).toBeGreaterThanOrEqual(400);

    const ok = await request(app.getHttpServer())
      .post('/api/infraction-policies')
      .set('Authorization', `Bearer ${supervisorToken}`)
      .send({
        infractionType: 'missed_daily_report',
        thresholdCount: 3,
        action: 'warn',
        actionLabel: 'تنبيه اختبار',
        enabled: true,
      });
    expect([200, 201]).toContain(ok.status);
    expect(ok.body.thresholdCount).toBe(3);

    const list = await request(app.getHttpServer())
      .get('/api/infraction-policies')
      .set('Authorization', `Bearer ${supervisorToken}`);
    expect(list.status).toBe(200);
    expect(
      (list.body as Array<{ actionLabel?: string }>).some(
        (p) => p.actionLabel === 'تنبيه اختبار',
      ),
    ).toBe(true);
  });

  it('teacher records attendance and generates weekly report for student', async () => {
    const groups = await request(app.getHttpServer())
      .get('/api/groups')
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(groups.status).toBeLessThan(400);
    const mine = (groups.body as Array<{ id: string }>)[0];
    expect(mine).toBeTruthy();

    const sessionDate = '2099-02-01';
    const att = await request(app.getHttpServer())
      .post('/api/attendance')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        studentId,
        groupId: mine!.id,
        sessionDate,
        status: 'present',
      });
    expect([200, 201]).toContain(att.status);

    const weekly = await request(app.getHttpServer())
      .post('/api/weekly-reports/generate')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        studentId,
        weekStartDate: '2099-01-26',
        weekEndDate: '2099-02-01',
      });
    expect([200, 201]).toContain(weekly.status);
    expect(weekly.body.studentId).toBe(studentId);
  });
});
