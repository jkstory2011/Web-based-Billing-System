import { CollectionsAgingService } from './collections-aging.service';

describe('CollectionsAgingService', () => {
  function buildService(invoices: any[]) {
    const prisma = { invoice: { findMany: jest.fn().mockResolvedValue(invoices) } } as any;
    return { service: new CollectionsAgingService(prisma), prisma };
  }

  const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

  it('buckets overdue invoices per customer by days overdue', async () => {
    const invoices = [
      { totalAmount: '100', dueDate: daysAgo(10), contract: { customer: { id: 'c1', name: 'A' } } },
      { totalAmount: '200', dueDate: daysAgo(45), contract: { customer: { id: 'c1', name: 'A' } } },
      { totalAmount: '300', dueDate: daysAgo(95), contract: { customer: { id: 'c2', name: 'B' } } },
    ];
    const { service } = buildService(invoices);

    const result = await service.getAgingReport();

    const c1 = result.find((r) => r.customerId === 'c1')!;
    expect(c1.buckets.d0to30).toBe('100');
    expect(c1.buckets.d31to60).toBe('200');
    expect(c1.buckets.d61to90).toBe('0');
    expect(c1.buckets.d90plus).toBe('0');
    expect(c1.totalOverdue).toBe('300');
    expect(c1.invoiceCount).toBe(2);
    expect(c1.customerName).toBe('A');

    const c2 = result.find((r) => r.customerId === 'c2')!;
    expect(c2.buckets.d90plus).toBe('300');
    expect(c2.invoiceCount).toBe(1);
  });

  it('returns an empty array when nothing is overdue', async () => {
    const { service } = buildService([]);

    await expect(service.getAgingReport()).resolves.toEqual([]);
  });

  it('queries only SENT invoices with a past due date', async () => {
    const { service, prisma } = buildService([]);

    await service.getAgingReport();

    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'SENT', dueDate: { lt: expect.any(Date) } } }),
    );
  });
});
