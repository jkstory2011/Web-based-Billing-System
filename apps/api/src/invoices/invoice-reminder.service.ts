import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { INVOICE_MAILER, InvoiceMailer } from './mailer/invoice-mailer.interface';

@Injectable()
export class InvoiceReminderService {
  private readonly logger = new Logger(InvoiceReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(INVOICE_MAILER) private readonly mailer: InvoiceMailer,
  ) {}

  async sendReminder(invoiceId: string): Promise<void> {
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
      });
    } catch (error) {
      this.logger.error(
        `Failed to email overdue reminder for invoice ${invoice.id} (customer: ${invoice.contract.customer.email}).`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }

    this.logger.log(`Sent overdue reminder for invoice ${invoice.id} to ${invoice.contract.customer.email}.`);
  }
}
