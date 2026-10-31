import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { ListReservationsQueryDto } from './dto/list-reservations-query.dto';
import { Reservation } from './entities/reservation.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Get('availability')
  checkAvailability(
    @Query() query: AvailabilityQueryDto,
  ): Promise<{ available: boolean }> {
    return this.reservationsService.checkAvailability(query);
  }

  @Get('booked-dates')
  getBookedDates(
    @Query('vanId', ParseUUIDPipe) vanId: string,
  ): Promise<{ startDate: string; endDate: string }[]> {
    return this.reservationsService.getBookedDates(vanId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Query() query: ListReservationsQueryDto): Promise<Reservation[]> {
    return this.reservationsService.findAll(query);
  }

  @Post()
  create(@Body() dto: CreateReservationDto): Promise<Reservation> {
    return this.reservationsService.create(dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Reservation> {
    return this.reservationsService.findOne(id);
  }

  @Patch(':id/lock')
  toggleLock(@Param('id', ParseUUIDPipe) id: string): Promise<Reservation> {
    return this.reservationsService.toggleLock(id);
  }
}
