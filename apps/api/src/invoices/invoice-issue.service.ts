import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Invoice, InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoicePdfStorageService } from './invoice-pdf-storage.service';
import { INVOICE_MAILER, InvoiceMailer } from './mailer/invoice-mailer.interface';

@Injectable()
export class InvoiceIssueService {
  private readonly logger = new Logger(InvoiceIssueService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: InvoicePdfService,
    private readonly pdfStorage: InvoicePdfStorageService,
    @Inject(INVOICE_MAILER) private readonly mailer: InvoiceMailer,
  ) {}

  async issueInvoice(invoiceId: string): Promise<Invoice> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { lineItems: true, contract: { include: { customer: true } } },
    });

    if (!invoice) {
      throw new NotFoundException('청구서를 찾을 수 없습니다.');
    }

    if (invoice.status === InvoiceStatus.SENT) {
      throw new ConflictException('이미 발송된 청구서입니다.');
    }

    const pdfBuffer = await this.pdfService.render(invoice);
    const pdfRecord = await this.pdfStorage.save(invoiceId, pdfBuffer);

    try {
      await this.mailer.sendInvoice({
        toEmail: invoice.contract.customer.email,
        invoiceId: invoice.id,
        totalAmount: invoice.totalAmount.toString(),
        dueDate: invoice.dueDate,
        pdfBuffer,
        pdfFileName: `invoice-${invoice.id}-v${pdfRecord.version}.pdf`,
      });
    } catch (error) {
      this.logger.error(
        `Failed to email invoice ${invoice.id} after persisting PDF version ${pdfRecord.version} (pdfRecord id: ${pdfRecord.id}). ` +
          `The PDF was saved but the invoice was not marked SENT; this PDF version may be orphaned.`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }

    return this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: InvoiceStatus.SENT, issueDate: new Date() },
    });
  }
}
