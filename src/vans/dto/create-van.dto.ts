import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';
import { VehicleType } from '../entities/vehicle-type.enum';

export class CreateVanDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsNumber()
  @IsPositive()
  pricePerDay: number;

  @IsOptional()
  @IsEnum(VehicleType)
  type?: VehicleType;
}
