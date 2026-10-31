import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Reservations (e2e)', () => {
  let app: INestApplication;
  let vanId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    const vansRes = await request(app.getHttpServer()).get('/vans');
    vanId = vansRes.body[0].id;
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('GET /vans returns the 3 seeded vans', async () => {
    const res = await request(app.getHttpServer()).get('/vans').expect(200);
    expect(res.body).toHaveLength(3);
  });

  it('books a van, then a conflicting booking is rejected, then a same-day turnover succeeds', async () => {
    const booking = {
      vanId,
      startDate: '2126-06-10',
      endDate: '2126-06-15',
      customerName: 'Jane Doe',
      customerEmail: 'jane@example.com',
      customerPhone: '555-1234',
    };

    const created = await request(app.getHttpServer())
      .post('/reservations')
      .send(booking)
      .expect(201);

    await request(app.getHttpServer())
      .get(`/reservations/${created.body.id}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/reservations')
      .send({
        ...booking,
        startDate: '2126-06-12',
        endDate: '2126-06-20',
        customerEmail: 'conflict@example.com',
      })
      .expect(409);

    await request(app.getHttpServer())
      .post('/reservations')
      .send({
        ...booking,
        startDate: '2126-06-15',
        endDate: '2126-06-18',
        customerEmail: 'turnover@example.com',
      })
      .expect(201);
  });

  it('rejects locking a reservation outside its rental window', async () => {
    const created = await request(app.getHttpServer())
      .post('/reservations')
      .send({
        vanId,
        startDate: '2126-07-01',
        endDate: '2126-07-05',
        customerName: 'Future Renter',
        customerEmail: 'future@example.com',
        customerPhone: '555-0000',
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/reservations/${created.body.id}/lock`)
      .expect(403);
  });

  it('allows toggling the lock while the rental is active', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const future = new Date();
    future.setDate(future.getDate() + 3);
    const futureDate = future.toISOString().slice(0, 10);

    const created = await request(app.getHttpServer())
      .post('/reservations')
      .send({
        vanId,
        startDate: today,
        endDate: futureDate,
        customerName: 'Current Renter',
        customerEmail: 'current@example.com',
        customerPhone: '555-9999',
      })
      .expect(201);

    const toggled = await request(app.getHttpServer())
      .patch(`/reservations/${created.body.id}/lock`)
      .expect(200);
    expect(toggled.body.isLocked).toBe(true);

    const toggledBack = await request(app.getHttpServer())
      .patch(`/reservations/${created.body.id}/lock`)
      .expect(200);
    expect(toggledBack.body.isLocked).toBe(false);
  }, 15000);
});
