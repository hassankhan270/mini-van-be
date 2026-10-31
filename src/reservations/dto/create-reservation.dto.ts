import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateReservationDto {
  @IsUUID()
  vanId: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsNotEmpty()
  @IsString()
  customerName: string;

  @IsEmail()
  customerEmail: string;

  @IsNotEmpty()
  @IsString()
  customerPhone: string;
}
