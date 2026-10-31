import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { VansService } from './vans.service';
import { Van } from './entities/van.entity';
import { Reservation } from '../reservations/entities/reservation.entity';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

type VanSeed = Partial<Van>[];

describe('VansService', () => {
  let service: VansService;
  let repository: {
    count: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let reservationsRepository: { count: jest.Mock };

  beforeEach(async () => {
    repository = {
      count: jest.fn(),
      save: jest.fn(),
      create: jest.fn((v: VanSeed) => v),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    reservationsRepository = { count: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VansService,
        { provide: getRepositoryToken(Van), useValue: repository },
        {
          provide: getRepositoryToken(Reservation),
          useValue: reservationsRepository,
        },
        {
          provide: CloudinaryService,
          useValue: { uploadBuffer: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(VansService);
  });

  describe('onModuleInit', () => {
    it('seeds the 3 vans when the table is empty', async () => {
      repository.count.mockResolvedValue(0);

      await service.onModuleInit();

      expect(repository.save).toHaveBeenCalledTimes(1);
      const calls = repository.create.mock.calls as [VanSeed][];
      const seeded = calls[0][0];
      expect(seeded).toHaveLength(3);
      expect(seeded.every((van) => typeof van.name === 'string')).toBe(true);
    });

    it('skips seeding when vans already exist', async () => {
      repository.count.mockResolvedValue(3);

      await service.onModuleInit();

      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when the van does not exist', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('findAvailable', () => {
    it('rejects an invalid date range before querying', async () => {
      await expect(
        service.findAvailable('2026-11-20', '2026-11-10'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('builds a NOT EXISTS query excluding vans with overlapping reservations', async () => {
      const freeVans = [{ id: 'van-2' }];
      const qb: Record<string, jest.Mock> = {
        setParameters: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(freeVans),
        subQuery: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getQuery: jest.fn().mockReturnValue('(SELECT 1)'),
      };
      // `.where` is called twice on the same mock object: once on the main
      // query with a callback, once on the subquery with a plain string.
      qb.where = jest.fn().mockImplementation((arg: unknown) => {
        if (typeof arg === 'function') {
          (arg as (q: typeof qb) => string)(qb);
        }
        return qb;
      });
      repository.createQueryBuilder.mockReturnValue(qb);

      const future = '2126-01-10';
      const futureEnd = '2126-01-15';
      const result = await service.findAvailable(future, futureEnd);

      expect(qb.setParameters).toHaveBeenCalledWith({
        startDate: future,
        endDate: futureEnd,
      });
      expect(result).toEqual(freeVans);
    });
  });

  describe('remove', () => {
    it('refuses to delete a van that has reservations', async () => {
      repository.findOne.mockResolvedValue({ id: 'van-1' });
      reservationsRepository.count.mockResolvedValue(2);

      await expect(service.remove('van-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(repository.remove).not.toHaveBeenCalled();
    });

    it('deletes a van with no reservations', async () => {
      const van = { id: 'van-1' };
      repository.findOne.mockResolvedValue(van);
      reservationsRepository.count.mockResolvedValue(0);

      await service.remove('van-1');

      expect(repository.remove).toHaveBeenCalledWith(van);
    });
  });
});
