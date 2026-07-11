import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { Invoice, InvoiceLineItem } from '@prisma/client';

export type InvoiceWithLineItems = Invoice & { lineItems: InvoiceLineItem[] };

@Injectable()
export class InvoicePdfService {
  render(invoice: InvoiceWithLineItems): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(18).text('청구서', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10);
      doc.text(`청구 기간: ${invoice.periodStart.toISOString().slice(0, 10)} ~ ${invoice.periodEnd.toISOString().slice(0, 10)}`);
      doc.text(`납부 기한: ${invoice.dueDate.toISOString().slice(0, 10)}`);
      doc.moveDown();

      invoice.lineItems.forEach((item) => {
        doc.text(`${item.description}  x${item.quantity}  ${item.amount.toString()}원`);
      });

      doc.moveDown();
      doc.fontSize(12).text(`합계: ${invoice.totalAmount.toString()}원`, { align: 'right' });

      doc.end();
    });
  }
}
