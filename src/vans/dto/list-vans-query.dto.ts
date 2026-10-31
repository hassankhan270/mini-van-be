import { IsEnum, IsOptional } from 'class-validator';
import { VehicleType } from '../entities/vehicle-type.enum';

export class ListVansQueryDto {
  @IsOptional()
  @IsEnum(VehicleType)
  type?: VehicleType;
}
