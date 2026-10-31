import { BadRequestException } from '@nestjs/common';

export function validateDateRange(startDate: string, endDate: string): void {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const today = new Date(new Date().toISOString().slice(0, 10));

  if (end <= start) {
    throw new BadRequestException('endDate must be after startDate');
  }
  if (start < today) {
    throw new BadRequestException('startDate cannot be in the past');
  }
}
