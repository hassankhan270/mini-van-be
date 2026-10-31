import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { VehicleType } from '../entities/vehicle-type.enum';

export class AvailableVansQueryDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsEnum(VehicleType)
  type?: VehicleType;
}
