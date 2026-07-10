import { IsDateString } from 'class-validator';

export class GenerateInvoicesDto {
  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;
}
