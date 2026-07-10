import { InvoiceGenerationService } from './invoice-generation.service';

describe('InvoiceGenerationService', () => {
  const periodStart = new Date('2026-07-01');
  const periodEnd = new Date('2026-07-31');

  const recurringItem = {
    id: 'recurring-1',
    contractId: 'contract-1',
    description: '월 이용료',
    period: 'MONTHLY',
    amount: 100000,
    startDate: new Date('2026-01-01'),
    endDate: null,
  };

  const adhocCharge = {
    id: 'adhoc-1',
    contractId: 'contract-1',
    description: '추가 작업비',
    amount: 50000,
    occurredOn: new Date('2026-07-15'),
  };

  const contract = {
    id: 'contract-1',
    status: 'ACTIVE',
    recurringItems: [recurringItem],
    adhocCharges: [adhocCharge],
  };

  function buildService(overrides: any = {}) {
    const prisma = {
      contract: { findMany: jest.fn().mockResolvedValue([contract]) },
      invoiceLineItem: { findMany: jest.fn().mockResolvedValue([]) },
      invoice: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 'invoice-1', ...data, lineItems: data.lineItems.create }),
        ),
      },
      ...overrides,
    } as any;
    return { service: new InvoiceGenerationService(prisma), prisma };
  }

  it('includes a recurring item and an adhoc charge that have not been invoiced yet', async () => {
    const { service } = buildService();

    const previews = await service.previewGeneration(periodStart, periodEnd);

    expect(previews).toEqual([
      { contractId: 'contract-1', recurringItems: [recurringItem], adhocCharges: [adhocCharge] },
    ]);
  });

  it('excludes a recurring item already invoiced for an overlapping period', async () => {
    const { service, prisma } = buildService({
      invoiceLineItem: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ recurringItemId: 'recurring-1' }])
          .mockResolvedValueOnce([]),
      },
    });

    const previews = await service.previewGeneration(periodStart, periodEnd);

    expect(previews).toEqual([{ contractId: 'contract-1', recurringItems: [], adhocCharges: [adhocCharge] }]);
  });

  it('excludes an adhoc charge that has already been invoiced', async () => {
    const { service } = buildService({
      invoiceLineItem: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ adhocChargeId: 'adhoc-1' }]),
      },
    });

    const previews = await service.previewGeneration(periodStart, periodEnd);

    expect(previews).toEqual([
      { contractId: 'contract-1', recurringItems: [recurringItem], adhocCharges: [] },
    ]);
  });

  it('creates an invoice with a total amount equal to the sum of its line items', async () => {
    const { service, prisma } = buildService();

    const invoices = await service.generateInvoices(periodStart, periodEnd);

    expect(invoices).toHaveLength(1);
    expect(prisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contractId: 'contract-1',
          totalAmount: expect.objectContaining({ d: expect.anything() }), // Prisma.Decimal internal shape
        }),
      }),
    );
    expect(invoices[0].totalAmount.toString()).toBe('150000');
  });

  it('produces no invoices for a contract with nothing to bill', async () => {
    const { service } = buildService({
      contract: {
        findMany: jest.fn().mockResolvedValue([{ ...contract, recurringItems: [], adhocCharges: [] }]),
      },
    });

    const invoices = await service.generateInvoices(periodStart, periodEnd);

    expect(invoices).toEqual([]);
  });
});
