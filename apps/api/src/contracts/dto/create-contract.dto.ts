import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CreateContractDto {
  @IsUUID()
  customerId!: string;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
