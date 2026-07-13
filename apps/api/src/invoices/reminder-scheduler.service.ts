import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InvoiceStatus, ReminderTrigger } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { InvoiceReminderService } from './invoice-reminder.service';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

@Injectable()
export class ReminderSchedulerService {
  private readonly logger = new Logger(ReminderSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
    private readonly invoiceReminderService: InvoiceReminderService,
  ) {}

  @Cron('0 9 * * *', { timeZone: 'Asia/Seoul' })
  handleDailyReminders(): Promise<void> {
    return this.runDailyReminders();
  }

  async runDailyReminders(): Promise<void> {
    const globalEnabled = await this.settingsService.isAutoReminderEnabled();
    const now = new Date();

    const overdueInvoices = await this.prisma.invoice.findMany({
      where: { status: InvoiceStatus.SENT, dueDate: { lt: now } },
      include: { contract: { include: { customer: true } } },
    });

    for (const invoice of overdueInvoices) {
      const override = invoice.contract.customer.autoReminderOverride;
      const isEnabled = override ?? globalEnabled;
      if (!isEnabled) {
        continue;
      }

      const daysOverdue = Math.floor((now.getTime() - invoice.dueDate.getTime()) / MS_PER_DAY);
      const stage = InvoiceReminderService.recommendedStage(daysOverdue);
      if (!stage) {
        continue;
      }

      const alreadySent = await this.prisma.collectionReminder.findFirst({ where: { invoiceId: invoice.id, stage } });
      if (alreadySent) {
        continue;
      }

      try {
        await this.invoiceReminderService.sendReminder(invoice.id, stage, ReminderTrigger.AUTO);
      } catch (error) {
        this.logger.error(
          `Failed to auto-send overdue reminder (stage: ${stage}) for invoice ${invoice.id}.`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }
}
