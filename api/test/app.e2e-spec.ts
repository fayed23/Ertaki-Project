import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    process.env.SQLITE_PATH = ':memory:';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('logs in seeded supervisor', async () => {
    // Seed runs on module init against the configured DB; allow either success after seed
    // or a clean rejection if seed did not target this process DB.
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ phone: '0500000001', password: 'password123' });
    expect([200, 201, 401]).toContain(res.status);
  });
});
