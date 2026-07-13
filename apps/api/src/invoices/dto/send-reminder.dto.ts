import { IsEnum } from 'class-validator';
import { ReminderStage } from '@prisma/client';

export class SendReminderDto {
  @IsEnum(ReminderStage)
  stage!: ReminderStage;
}
