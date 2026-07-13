import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InvoiceStatus, ReminderStage, ReminderTrigger } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { INVOICE_MAILER, InvoiceMailer } from './mailer/invoice-mailer.interface';

const STAGE_THRESHOLDS_DESC: { minDays: number; stage: ReminderStage }[] = [
  { minDays: 60, stage: ReminderStage.FINAL },
  { minDays: 30, stage: ReminderStage.SECOND },
  { minDays: 7, stage: ReminderStage.FIRST },
];

@Injectable()
export class InvoiceReminderService {
  private readonly logger = new Logger(InvoiceReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(INVOICE_MAILER) private readonly mailer: InvoiceMailer,
  ) {}

  static recommendedStage(daysOverdue: number): ReminderStage | null {
    const match = STAGE_THRESHOLDS_DESC.find((threshold) => daysOverdue >= threshold.minDays);
    return match ? match.stage : null;
  }

  async sendReminder(
    invoiceId: string,
    stage: ReminderStage,
    triggeredBy: ReminderTrigger,
    adminUserId?: string,
  ): Promise<void> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { contract: { include: { customer: true } } },
    });

    if (!invoice) {
      throw new NotFoundException('청구서를 찾을 수 없습니다.');
    }

    if (invoice.status !== InvoiceStatus.SENT) {
      throw new ConflictException('발송되지 않은 청구서에는 미납 알림을 보낼 수 없습니다.');
    }

    if (invoice.dueDate >= new Date()) {
      throw new ConflictException('아직 납부기한이 지나지 않았습니다.');
    }

    try {
      await this.mailer.sendOverdueReminder({
        toEmail: invoice.contract.customer.email,
        invoiceId: invoice.id,
        totalAmount: invoice.totalAmount.toString(),
        dueDate: invoice.dueDate,
        stage,
      });
    } catch (error) {
      this.logger.error(
        `Failed to email overdue reminder (stage: ${stage}) for invoice ${invoice.id} (customer: ${invoice.contract.customer.email}).`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }

    await this.prisma.collectionReminder.create({
      data: {
        invoiceId: invoice.id,
        stage,
        triggeredBy,
        sentByAdminUserId: adminUserId ?? null,
      },
    });

    this.logger.log(
      `Sent overdue reminder (stage: ${stage}, trigger: ${triggeredBy}) for invoice ${invoice.id} to ${invoice.contract.customer.email}.`,
    );
  }

  async listReminders(invoiceId: string) {
    const exists = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!exists) {
      throw new NotFoundException('청구서를 찾을 수 없습니다.');
    }
    return this.prisma.collectionReminder.findMany({
      where: { invoiceId },
      include: { sentByAdminUser: true },
      orderBy: { sentAt: 'desc' },
    });
  }
}
