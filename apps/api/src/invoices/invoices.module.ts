import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoiceGenerationService } from './invoice-generation.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoicePdfStorageService } from './invoice-pdf-storage.service';
import { InvoiceIssueService } from './invoice-issue.service';
import { INVOICE_MAILER } from './mailer/invoice-mailer.interface';
import { NodemailerInvoiceMailer } from './mailer/nodemailer-invoice-mailer';

@Module({
  controllers: [InvoicesController],
  providers: [
    InvoiceGenerationService,
    InvoicePdfService,
    InvoicePdfStorageService,
    InvoiceIssueService,
    { provide: INVOICE_MAILER, useClass: NodemailerInvoiceMailer },
  ],
  exports: [InvoiceGenerationService],
})
export class InvoicesModule {}
