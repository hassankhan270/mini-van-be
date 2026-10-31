import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Van } from './entities/van.entity';
import { Reservation } from '../reservations/entities/reservation.entity';
import { VansService } from './vans.service';
import { VansController } from './vans.controller';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Van, Reservation]),
    CloudinaryModule,
    AuthModule,
  ],
  controllers: [VansController],
  providers: [VansService],
  exports: [VansService],
})
export class VansModule {}
