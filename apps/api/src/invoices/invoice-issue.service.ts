import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { Invoice, InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoicePdfStorageService } from './invoice-pdf-storage.service';
import { INVOICE_MAILER, InvoiceMailer } from './mailer/invoice-mailer.interface';

@Injectable()
export class InvoiceIssueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: InvoicePdfService,
    private readonly pdfStorage: InvoicePdfStorageService,
    @Inject(INVOICE_MAILER) private readonly mailer: InvoiceMailer,
  ) {}

  async issueInvoice(invoiceId: string): Promise<Invoice> {
    const invoice = await this.prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: { lineItems: true, contract: { include: { customer: true } } },
    });

    if (invoice.status === InvoiceStatus.SENT) {
      throw new ConflictException('이미 발송된 청구서입니다.');
    }

    const pdfBuffer = await this.pdfService.render(invoice);
    const pdfRecord = await this.pdfStorage.save(invoiceId, pdfBuffer);

    await this.mailer.sendInvoice({
      toEmail: invoice.contract.customer.email,
      invoiceId: invoice.id,
      totalAmount: invoice.totalAmount.toString(),
      dueDate: invoice.dueDate,
      pdfBuffer,
      pdfFileName: `invoice-${invoice.id}-v${pdfRecord.version}.pdf`,
    });

    return this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: InvoiceStatus.SENT, issueDate: new Date() },
    });
  }
}
