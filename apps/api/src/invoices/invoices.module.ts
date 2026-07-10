import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoiceGenerationService } from './invoice-generation.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoicePdfStorageService } from './invoice-pdf-storage.service';
import { InvoiceIssueService } from './invoice-issue.service';
import { INVOICE_MAILER } from './mailer/invoice-mailer.interface';
import { NodemailerInvoiceMailer } from './mailer/nodemailer-invoice-mailer';
import { PortalInvoicesController } from './portal-invoices.controller';
import { PortalInvoicesService } from './portal-invoices.service';

@Module({
  controllers: [InvoicesController, PortalInvoicesController],
  providers: [
    InvoiceGenerationService,
    InvoicePdfService,
    InvoicePdfStorageService,
    InvoiceIssueService,
    PortalInvoicesService,
    { provide: INVOICE_MAILER, useClass: NodemailerInvoiceMailer },
  ],
  exports: [InvoiceGenerationService],
})
export class InvoicesModule {}
