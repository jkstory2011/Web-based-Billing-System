import { Injectable, NotFoundException } from '@nestjs/common';
import { Invoice } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InvoicesQueryService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<Invoice[]> {
    return this.prisma.invoice.findMany({
      include: { contract: { include: { customer: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<Invoice> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { lineItems: true, contract: { include: { customer: true } } },
    });
    if (!invoice) {
      throw new NotFoundException('청구서를 찾을 수 없습니다.');
    }
    return invoice;
  }

  async getLatestPdfPath(invoiceId: string): Promise<string> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { pdfs: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!invoice || invoice.pdfs.length === 0) {
      throw new NotFoundException('청구서 PDF를 찾을 수 없습니다.');
    }
    return invoice.pdfs[0].filePath;
  }
}
