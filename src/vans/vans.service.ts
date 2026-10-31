import {
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Van } from './entities/van.entity';
import { Reservation } from '../reservations/entities/reservation.entity';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CreateVanDto } from './dto/create-van.dto';
import { UpdateVanDto } from './dto/update-van.dto';
import { validateDateRange } from '../common/validate-date-range';
import { VehicleType } from './entities/vehicle-type.enum';

const DEFAULT_IMAGE_URL =
  'https://images.pexels.com/photos/2330197/pexels-photo-2330197.jpeg?cs=tinysrgb&w=800';

const SEED_VANS: Partial<Van>[] = [
  {
    name: 'Compact Camper Van',
    description:
      'Cozy 2-berth camper with a pop-up bed and mini kitchenette, perfect for weekend getaways.',
    imageUrl:
      'https://res.cloudinary.com/dfh4q0rct/image/upload/v1793426005/mini-van-rentals/compact-camper-van.jpg',
    pricePerDay: 89,
    type: VehicleType.VAN,
  },
  {
    name: 'Family Adventure Van',
    description:
      'Spacious 6-seat van with a pop-top roof, extra storage, and room for the whole family.',
    imageUrl:
      'https://res.cloudinary.com/dfh4q0rct/image/upload/v1793426006/mini-van-rentals/family-adventure-van.jpg',
    pricePerDay: 129,
    type: VehicleType.VAN,
  },
  {
    name: 'Cargo Explorer Van',
    description:
      'Rugged all-terrain van ideal for road trips, gear hauling, and off-the-beaten-path routes.',
    imageUrl:
      'https://res.cloudinary.com/dfh4q0rct/image/upload/v1793426006/mini-van-rentals/cargo-explorer-van.jpg',
    pricePerDay: 109,
    type: VehicleType.VAN,
  },
];

@Injectable()
export class VansService implements OnModuleInit {
  constructor(
    @InjectRepository(Van)
    private readonly vansRepository: Repository<Van>,
    @InjectRepository(Reservation)
    private readonly reservationsRepository: Repository<Reservation>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async onModuleInit(): Promise<void> {
    const count = await this.vansRepository.count();
    if (count === 0) {
      await this.vansRepository.save(this.vansRepository.create(SEED_VANS));
    }
  }

  findAll(type?: VehicleType): Promise<Van[]> {
    return this.vansRepository.find({
      where: type ? { type } : {},
      order: { createdAt: 'ASC' },
    });
  }

  async findAvailable(
    startDate: string,
    endDate: string,
    type?: VehicleType,
  ): Promise<Van[]> {
    validateDateRange(startDate, endDate);

    const qb = this.vansRepository
      .createQueryBuilder('van')
      .where((qb) => {
        const subQuery = qb
          .subQuery()
          .select('1')
          .from(Reservation, 'reservation')
          .where('reservation.vanId = van.id')
          .andWhere('reservation.startDate < :endDate')
          .andWhere('reservation.endDate > :startDate')
          .getQuery();
        return `NOT EXISTS ${subQuery}`;
      })
      .setParameters({ startDate, endDate })
      .orderBy('van.createdAt', 'ASC');

    if (type) {
      qb.andWhere('van.type = :type', { type });
    }

    return qb.getMany();
  }

  async findOne(id: string): Promise<Van> {
    const van = await this.vansRepository.findOne({ where: { id } });
    if (!van) {
      throw new NotFoundException(`Van ${id} not found`);
    }
    return van;
  }

  async updateImage(id: string, buffer: Buffer): Promise<Van> {
    const van = await this.findOne(id);
    const result = await this.cloudinaryService.uploadBuffer(buffer, van.id);
    van.imageUrl = result.secure_url;
    return this.vansRepository.save(van);
  }

  create(dto: CreateVanDto): Promise<Van> {
    const van = this.vansRepository.create({
      ...dto,
      imageUrl: dto.imageUrl ?? DEFAULT_IMAGE_URL,
    });
    return this.vansRepository.save(van);
  }

  async update(id: string, dto: UpdateVanDto): Promise<Van> {
    const van = await this.findOne(id);
    Object.assign(van, dto);
    return this.vansRepository.save(van);
  }

  async remove(id: string): Promise<void> {
    const van = await this.findOne(id);
    const reservationCount = await this.reservationsRepository.count({
      where: { vanId: van.id },
    });
    if (reservationCount > 0) {
      throw new ConflictException('Cannot delete a van that has reservations');
    }
    await this.vansRepository.remove(van);
  }
}
