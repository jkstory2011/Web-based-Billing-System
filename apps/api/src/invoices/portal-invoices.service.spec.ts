import { NotFoundException } from '@nestjs/common';
import { PortalInvoicesService } from './portal-invoices.service';

describe('PortalInvoicesService', () => {
  function buildService(overrides: any = {}) {
    const prisma = {
      invoice: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      ...overrides,
    } as any;
    return { service: new PortalInvoicesService(prisma), prisma };
  }

  it('lists only SENT invoices scoped to the customer', async () => {
    const { service, prisma } = buildService();

    await service.findForCustomer('cust-1');

    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { contract: { customerId: 'cust-1' }, status: 'SENT' },
      }),
    );
  });

  it('throws NotFoundException when the invoice has no PDF yet', async () => {
    const { service, prisma } = buildService({
      invoice: { findFirst: jest.fn().mockResolvedValue({ id: 'invoice-1', pdfs: [] }) },
    });

    await expect(service.getLatestPdfPath('invoice-1', 'cust-1')).rejects.toThrow(NotFoundException);
    expect(prisma.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'invoice-1', contract: { customerId: 'cust-1' } } }),
    );
  });

  it('returns the highest-version PDF file path', async () => {
    const { service } = buildService({
      invoice: {
        findFirst: jest.fn().mockResolvedValue({ id: 'invoice-1', pdfs: [{ filePath: '/storage/invoice-1/v2.pdf', version: 2 }] }),
      },
    });

    const path = await service.getLatestPdfPath('invoice-1', 'cust-1');

    expect(path).toBe('/storage/invoice-1/v2.pdf');
  });
});
