import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { Van } from '../vans/entities/van.entity';
import { Reservation } from '../reservations/entities/reservation.entity';
import { Admin } from '../auth/entities/admin.entity';

export const typeOrmConfigFactory = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  url: configService.get<string>('DATABASE_URL'),
  entities: [Van, Reservation, Admin],
  synchronize: true,
  ssl: { rejectUnauthorized: false },
});
