import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { Reservation } from './entities/reservation.entity';
import { VansService } from '../vans/vans.service';

describe('ReservationsService', () => {
  let service: ReservationsService;
  let reservationsRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
  };
  let dataSource: {
    manager: { getRepository: jest.Mock };
    transaction: jest.Mock;
    query: jest.Mock;
  };
  let vansService: { findOne: jest.Mock };

  const makeQueryBuilder = (rows: Partial<Reservation>[]) => {
    const qb: Record<string, jest.Mock> = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(rows.length),
      getMany: jest.fn().mockResolvedValue(rows),
    };
    return qb;
  };

  beforeEach(async () => {
    reservationsRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };
    dataSource = {
      manager: { getRepository: jest.fn() },
      transaction: jest.fn(),
      query: jest.fn().mockResolvedValue(undefined),
    };
    vansService = { findOne: jest.fn().mockResolvedValue({ id: 'van-1' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        {
          provide: getRepositoryToken(Reservation),
          useValue: reservationsRepository,
        },
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: VansService, useValue: vansService },
      ],
    }).compile();

    service = module.get(ReservationsService);
  });

  describe('checkAvailability', () => {
    it('allows a same-day turnover (existing ends day X, new starts day X)', async () => {
      const existing = { startDate: '2026-11-10', endDate: '2026-11-15' };
      dataSource.manager.getRepository.mockReturnValue({
        createQueryBuilder: () => makeQueryBuilder([existing]),
      });
      // overlap predicate: existing.start < new.end AND existing.end > new.start
      // new.start = existing.end -> existing.end > new.start is false -> no overlap
      dataSource.manager.getRepository.mockReturnValue({
        createQueryBuilder: () => makeQueryBuilder([]),
      });

      const result = await service.checkAvailability({
        vanId: 'van-1',
        startDate: '2026-11-15',
        endDate: '2026-11-18',
      });

      expect(result).toEqual({ available: true });
    });

    it('detects a genuine overlap', async () => {
      dataSource.manager.getRepository.mockReturnValue({
        createQueryBuilder: () =>
          makeQueryBuilder([
            { startDate: '2026-11-10', endDate: '2026-11-15' },
          ]),
      });

      const result = await service.checkAvailability({
        vanId: 'van-1',
        startDate: '2026-11-12',
        endDate: '2026-11-20',
      });

      expect(result).toEqual({ available: false });
    });

    it('rejects endDate <= startDate', async () => {
      await expect(
        service.checkAvailability({
          vanId: 'van-1',
          startDate: '2026-11-20',
          endDate: '2026-11-10',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('getBookedDates', () => {
    it('returns only the date ranges for the given van, no customer data', async () => {
      const ranges = [
        { startDate: '2026-11-10', endDate: '2026-11-15' },
        { startDate: '2026-12-01', endDate: '2026-12-05' },
      ];
      reservationsRepository.find.mockResolvedValue(ranges);

      const result = await service.getBookedDates('van-1');

      expect(vansService.findOne).toHaveBeenCalledWith('van-1');
      expect(reservationsRepository.find).toHaveBeenCalledWith({
        where: { vanId: 'van-1' },
        select: ['startDate', 'endDate'],
        order: { startDate: 'ASC' },
        loadEagerRelations: false,
      });
      expect(result).toEqual(ranges);
    });
  });

  describe('create', () => {
    it('throws ConflictException when the transaction finds an overlap', async () => {
      dataSource.transaction.mockImplementation(
        (cb: (manager: unknown) => Promise<unknown>) => {
          const manager = {
            getRepository: () => ({
              createQueryBuilder: () => makeQueryBuilder([{ id: 'existing' }]),
            }),
          };
          return cb(manager);
        },
      );

      const future = '2126-01-10';
      const futureEnd = '2126-01-15';

      await expect(
        service.create({
          vanId: 'van-1',
          startDate: future,
          endDate: futureEnd,
          customerName: 'Jane',
          customerEmail: 'jane@example.com',
          customerPhone: '555-1234',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects a startDate in the past', async () => {
      await expect(
        service.create({
          vanId: 'van-1',
          startDate: '2000-01-01',
          endDate: '2000-01-05',
          customerName: 'Jane',
          customerEmail: 'jane@example.com',
          customerPhone: '555-1234',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('toggleLock', () => {
    const buildReservation = (startDate: string, endDate: string) => ({
      id: 'res-1',
      startDate,
      endDate,
      isLocked: false,
    });

    it('allows toggling when today is within the rental window', async () => {
      const reservation = buildReservation('2000-01-01', '2999-01-01');
      reservationsRepository.findOne.mockResolvedValue(reservation);
      reservationsRepository.save.mockImplementation(
        (r: Partial<Reservation>) => r,
      );

      const result = await service.toggleLock('res-1');

      expect(result.isLocked).toBe(true);
    });

    it('rejects toggling before the rental window starts', async () => {
      const reservation = buildReservation('2999-01-01', '2999-01-05');
      reservationsRepository.findOne.mockResolvedValue(reservation);

      await expect(service.toggleLock('res-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('rejects toggling after the rental window ends', async () => {
      const reservation = buildReservation('2000-01-01', '2000-01-05');
      reservationsRepository.findOne.mockResolvedValue(reservation);

      await expect(service.toggleLock('res-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });
});
