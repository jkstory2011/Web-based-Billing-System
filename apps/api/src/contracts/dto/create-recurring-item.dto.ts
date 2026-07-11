import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { RecurringPeriod } from '@prisma/client';

export class CreateRecurringItemDto {
  @IsString()
  description!: string;

  @IsEnum(RecurringPeriod)
  period!: RecurringPeriod;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
