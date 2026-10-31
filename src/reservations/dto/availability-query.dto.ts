import { IsDateString, IsUUID } from 'class-validator';

export class AvailabilityQueryDto {
  @IsUUID()
  vanId: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}
