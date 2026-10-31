import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';
import { VehicleType } from '../entities/vehicle-type.enum';

export class UpdateVanDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  pricePerDay?: number;

  @IsOptional()
  @IsEnum(VehicleType)
  type?: VehicleType;
}
