import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Reservation } from './entities/reservation.entity';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { ListReservationsQueryDto } from './dto/list-reservations-query.dto';
import { VansService } from '../vans/vans.service';
import { validateDateRange } from '../common/validate-date-range';

const EXCLUSION_VIOLATION = '23P01';
const DUPLICATE_OBJECT = '42710';

@Injectable()
export class ReservationsService implements OnModuleInit {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationsRepository: Repository<Reservation>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly vansService: VansService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.dataSource.query('CREATE EXTENSION IF NOT EXISTS btree_gist');
      await this.dataSource.query(`
        ALTER TABLE "reservations"
        ADD CONSTRAINT "no_overlapping_reservations"
        EXCLUDE USING gist (
          "vanId" gist_uuid_ops WITH =,
          daterange("startDate", "endDate", '[)') WITH &&
        )
      `);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code !== DUPLICATE_OBJECT) {
        console.warn(
          'Could not create overlap-prevention constraint (relying on transaction + row lock only):',
          (err as Error).message,
        );
      }
    }
  }

  private todayUtcMidnight(): Date {
    return new Date(new Date().toISOString().slice(0, 10));
  }

  private buildOverlapQuery(
    manager: EntityManager,
    vanId: string,
    startDate: string,
    endDate: string,
  ) {
    return manager
      .getRepository(Reservation)
      .createQueryBuilder('reservation')
      .where('reservation.vanId = :vanId', { vanId })
      .andWhere('reservation.startDate < :endDate', { endDate })
      .andWhere('reservation.endDate > :startDate', { startDate });
  }

  private async hasOverlap(
    vanId: string,
    startDate: string,
    endDate: string,
  ): Promise<boolean> {
    const count = await this.buildOverlapQuery(
      this.dataSource.manager,
      vanId,
      startDate,
      endDate,
    ).getCount();
    return count > 0;
  }

  async getBookedDates(
    vanId: string,
  ): Promise<{ startDate: string; endDate: string }[]> {
    await this.vansService.findOne(vanId);
    return this.reservationsRepository.find({
      where: { vanId },
      select: ['startDate', 'endDate'],
      order: { startDate: 'ASC' },
      loadEagerRelations: false,
    });
  }

  async checkAvailability(
    query: AvailabilityQueryDto,
  ): Promise<{ available: boolean }> {
    await this.vansService.findOne(query.vanId);
    validateDateRange(query.startDate, query.endDate);
    const overlap = await this.hasOverlap(
      query.vanId,
      query.startDate,
      query.endDate,
    );
    return { available: !overlap };
  }

  async create(dto: CreateReservationDto): Promise<Reservation> {
    await this.vansService.findOne(dto.vanId);
    validateDateRange(dto.startDate, dto.endDate);

    return this.dataSource.transaction(async (manager) => {
      const conflicting = await this.buildOverlapQuery(
        manager,
        dto.vanId,
        dto.startDate,
        dto.endDate,
      )
        .setLock('pessimistic_write')
        .getMany();

      if (conflicting.length > 0) {
        throw new ConflictException(
          'Van is already booked for the selected dates',
        );
      }

      const repo = manager.getRepository(Reservation);
      const reservation = repo.create({
        vanId: dto.vanId,
        startDate: dto.startDate,
        endDate: dto.endDate,
        customerName: dto.customerName,
        customerEmail: dto.customerEmail,
        customerPhone: dto.customerPhone,
      });

      try {
        const saved = await repo.save(reservation);
        const withVan = await repo.findOne({ where: { id: saved.id } });
        return withVan as Reservation;
      } catch (err) {
        if ((err as { code?: string }).code === EXCLUSION_VIOLATION) {
          throw new ConflictException(
            'Van is already booked for the selected dates',
          );
        }
        throw err;
      }
    });
  }

  async findAll(query: ListReservationsQueryDto): Promise<Reservation[]> {
    const qb = this.reservationsRepository
      .createQueryBuilder('reservation')
      .leftJoinAndSelect('reservation.van', 'van')
      .orderBy('reservation.startDate', 'ASC');

    if (query.vanId) {
      qb.andWhere('reservation.vanId = :vanId', { vanId: query.vanId });
    }
    if (query.type) {
      qb.andWhere('van.type = :type', { type: query.type });
    }
    if (query.startDate && query.endDate) {
      qb.andWhere('reservation.startDate < :endDate', {
        endDate: query.endDate,
      }).andWhere('reservation.endDate > :startDate', {
        startDate: query.startDate,
      });
    }

    return qb.getMany();
  }

  async findOne(id: string): Promise<Reservation> {
    const reservation = await this.reservationsRepository.findOne({
      where: { id },
    });
    if (!reservation) {
      throw new NotFoundException(`Reservation ${id} not found`);
    }
    return reservation;
  }

  async toggleLock(id: string): Promise<Reservation> {
    const reservation = await this.findOne(id);

    const today = this.todayUtcMidnight();
    const start = new Date(reservation.startDate);
    const end = new Date(reservation.endDate);

    if (today < start || today > end) {
      throw new ForbiddenException(
        'Lock can only be toggled during the active rental period',
      );
    }

    reservation.isLocked = !reservation.isLocked;
    return this.reservationsRepository.save(reservation);
  }
}
