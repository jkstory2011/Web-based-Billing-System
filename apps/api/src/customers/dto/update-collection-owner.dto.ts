import { IsUUID, ValidateIf } from 'class-validator';

export class UpdateCollectionOwnerDto {
  @ValidateIf((o) => o.adminUserId !== null)
  @IsUUID()
  adminUserId!: string | null;
}
