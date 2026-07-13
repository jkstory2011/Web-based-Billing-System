import { IsBoolean, ValidateIf } from 'class-validator';

export class UpdateAutoReminderOverrideDto {
  @ValidateIf((o) => o.autoReminderOverride !== null)
  @IsBoolean()
  autoReminderOverride!: boolean | null;
}
