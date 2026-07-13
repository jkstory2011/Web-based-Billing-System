import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCollectionNoteDto {
  @IsString()
  @IsNotEmpty()
  body!: string;

  @IsOptional()
  @IsUUID()
  invoiceId?: string;
}
