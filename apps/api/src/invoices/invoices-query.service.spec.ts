import { NotFoundException } from '@nestjs/common';
import { InvoicesQueryService } from './invoices-query.service';

describe('InvoicesQueryService', () => {
  function buildService(overrides: any = {}) {
    const prisma = {
      invoice: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      ...overrides,
    } as any;
    return { service: new InvoicesQueryService(prisma), prisma };
  }

  it('lists invoices with contract and customer included, newest first', async () => {
    const { service, prisma } = buildService();

    await service.findAll();

    expect(prisma.invoice.findMany).toHaveBeenCalledWith({
      include: { contract: { include: { customer: true } } },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('throws NotFoundException when the invoice does not exist', async () => {
    const { service } = buildService();

    await expect(service.findOne('missing-id')).rejects.toThrow(NotFoundException);
  });

  it('returns the invoice with line items and customer when found', async () => {
    const invoice = { id: 'invoice-1', lineItems: [], contract: { customer: { name: '고객사' } } };
    const { service, prisma } = buildService({
      invoice: { findUnique: jest.fn().mockResolvedValue(invoice) },
    });

    const result = await service.findOne('invoice-1');

    expect(result).toBe(invoice);
    expect(prisma.invoice.findUnique).toHaveBeenCalledWith({
      where: { id: 'invoice-1' },
      include: { lineItems: true, contract: { include: { customer: true } } },
    });
  });

  it('throws NotFoundException when no PDF has been generated yet', async () => {
    const { service, prisma } = buildService({
      invoice: { findUnique: jest.fn().mockResolvedValue({ id: 'invoice-1', pdfs: [] }) },
    });

    await expect(service.getLatestPdfPath('invoice-1')).rejects.toThrow(NotFoundException);
    expect(prisma.invoice.findUnique).toHaveBeenCalledWith({
      where: { id: 'invoice-1' },
      include: { pdfs: { orderBy: { version: 'desc' }, take: 1 } },
    });
  });

  it('returns the highest-version PDF file path', async () => {
    const { service } = buildService({
      invoice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'invoice-1',
          pdfs: [{ filePath: '/storage/invoice-1/v2.pdf', version: 2 }],
        }),
      },
    });

    const path = await service.getLatestPdfPath('invoice-1');

    expect(path).toBe('/storage/invoice-1/v2.pdf');
  });
});
