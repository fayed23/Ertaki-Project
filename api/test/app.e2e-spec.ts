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

  it('student request: daily excuse approve marks day excused', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/student-requests')
      .set('Authorization', `Bearer ${studentToken}`)
      .field('type', 'daily_report_excuse')
      .field('relevantDate', '2099-03-10')
      .field('reason', 'مرض يمنع إرسال التقرير');
    expect([200, 201]).toContain(created.status);
    expect(created.body.status).toBe('pending');
    expect(created.body.type).toBe('daily_report_excuse');
    const id = created.body.id as string;

    const peerDenied = peerToken
      ? await request(app.getHttpServer())
          .get(`/api/student-requests/${id}`)
          .set('Authorization', `Bearer ${peerToken}`)
      : { status: 403 };
    expect(peerDenied.status).toBeGreaterThanOrEqual(400);

    const approved = await request(app.getHttpServer())
      .patch(`/api/student-requests/${id}/review`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ approve: true, reviewerNote: 'عذر مقبول' });
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe('approved');

    const reports = await request(app.getHttpServer())
      .get('/api/daily-reports?reportDate=2099-03-10')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(reports.status).toBe(200);
    const day = (reports.body as Array<{ reportDate: string; status: string }>).find(
      (r) => r.reportDate === '2099-03-10',
    );
    expect(day?.status).toBe('excused');
  });

  it('student request: weekly absence approve sets attendance excused', async () => {
    const membership = await request(app.getHttpServer())
      .get('/api/memberships/me')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(membership.status).toBeLessThan(400);
    const groupId = membership.body?.group?.id as string;
    expect(groupId).toBeTruthy();

    const created = await request(app.getHttpServer())
      .post('/api/student-requests')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        type: 'weekly_session_absence',
        relevantDate: '2099-03-15',
        reason: 'موعد طبي',
        groupId,
      });
    expect([200, 201]).toContain(created.status);

    const approved = await request(app.getHttpServer())
      .patch(`/api/student-requests/${created.body.id}/review`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ approve: true });
    expect(approved.status).toBe(200);

    const att = await request(app.getHttpServer())
      .get(`/api/attendance?groupId=${groupId}&sessionDate=2099-03-15`)
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(att.status).toBe(200);
    const row = (
      att.body as Array<{ studentId: string; status: string; excuseRequestId?: string }>
    ).find((a) => a.studentId === studentId);
    expect(row?.status).toBe('excused');
    expect(row?.excuseRequestId).toBe(created.body.id);

    const stats = await request(app.getHttpServer())
      .get('/api/student-requests/stats')
      .set('Authorization', `Bearer ${supervisorToken}`);
    expect(stats.status).toBe(200);
    expect(stats.body.total).toBeGreaterThanOrEqual(1);
  });
});
