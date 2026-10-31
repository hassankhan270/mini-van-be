import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { VehicleType } from '../../vans/entities/vehicle-type.enum';

export class ListReservationsQueryDto {
  @IsOptional()
  @IsUUID()
  vanId?: string;

  @IsOptional()
  @IsEnum(VehicleType)
  type?: VehicleType;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
