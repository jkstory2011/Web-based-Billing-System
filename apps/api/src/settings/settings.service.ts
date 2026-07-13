import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const SETTINGS_ID = 'default';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings() {
    const existing = await this.prisma.systemSettings.findUnique({ where: { id: SETTINGS_ID } });
    if (existing) {
      return existing;
    }
    return this.prisma.systemSettings.create({ data: { id: SETTINGS_ID, autoReminderEnabled: false } });
  }

  updateSettings(autoReminderEnabled: boolean) {
    return this.prisma.systemSettings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, autoReminderEnabled },
      update: { autoReminderEnabled },
    });
  }

  async isAutoReminderEnabled(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.autoReminderEnabled;
  }
}
