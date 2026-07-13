import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCollectionNoteDto } from './dto/create-collection-note.dto';

@Injectable()
export class CollectionNotesService {
  constructor(private readonly prisma: PrismaService) {}

  async listForCustomer(customerId: string) {
    await this.assertCustomerExists(customerId);
    return this.prisma.collectionNote.findMany({
      where: { customerId },
      include: { authorAdminUser: true, invoice: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(customerId: string, dto: CreateCollectionNoteDto, authorAdminUserId: string) {
    await this.assertCustomerExists(customerId);

    if (dto.invoiceId) {
      const invoice = await this.prisma.invoice.findUnique({
        where: { id: dto.invoiceId },
        include: { contract: true },
      });
      if (!invoice || invoice.contract.customerId !== customerId) {
        throw new BadRequestException('이 고객 소속의 청구서가 아닙니다.');
      }
    }

    return this.prisma.collectionNote.create({
      data: {
        customerId,
        invoiceId: dto.invoiceId ?? null,
        authorAdminUserId,
        body: dto.body,
      },
      include: { authorAdminUser: true, invoice: true },
    });
  }

  private async assertCustomerExists(customerId: string): Promise<void> {
    const exists = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!exists) {
      throw new NotFoundException('고객을 찾을 수 없습니다.');
    }
  }
}
