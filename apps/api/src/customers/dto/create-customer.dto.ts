import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { CustomerType } from '@prisma/client';

export class CreateCustomerDto {
  @IsEnum(CustomerType)
  type: CustomerType;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  businessRegNo?: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
