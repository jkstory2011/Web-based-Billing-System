import { IsDateString, IsNumber, IsString, Min } from 'class-validator';

export class CreateAdhocChargeDto {
  @IsString()
  description!: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsDateString()
  occurredOn!: string;
}
