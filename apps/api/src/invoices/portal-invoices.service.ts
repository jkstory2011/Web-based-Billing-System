import { Injectable, NotFoundException } from '@nestjs/common';
import { Invoice, InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PortalInvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  findForCustomer(customerId: string): Promise<Invoice[]> {
    return this.prisma.invoice.findMany({
      where: { contract: { customerId }, status: InvoiceStatus.SENT },
      include: { lineItems: true },
      orderBy: { issueDate: 'desc' },
    });
  }

  async getLatestPdfPath(invoiceId: string, customerId: string): Promise<string> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, contract: { customerId } },
      include: { pdfs: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!invoice || invoice.pdfs.length === 0) {
      throw new NotFoundException('청구서 PDF를 찾을 수 없습니다.');
    }
    return invoice.pdfs[0].filePath;
  }
}
