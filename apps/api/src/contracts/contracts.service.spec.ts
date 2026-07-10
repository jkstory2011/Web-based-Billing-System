import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ContractsService } from './contracts.service';

describe('ContractsService', () => {
  const contract = { id: 'contract-1', customerId: 'cust-1', recurringItems: [], adhocCharges: [] };

  function buildService(overrides: any = {}) {
    const prisma = {
      contract: {
        create: jest.fn().mockResolvedValue(contract),
        findMany: jest.fn().mockResolvedValue([contract]),
        findUnique: jest.fn().mockResolvedValue(contract),
      },
      contractRecurringItem: {
        create: jest.fn().mockResolvedValue({ id: 'item-1', contractId: 'contract-1' }),
      },
      adhocCharge: {
        create: jest.fn().mockResolvedValue({ id: 'charge-1', contractId: 'contract-1' }),
      },
      ...overrides,
    } as any;
    return { service: new ContractsService(prisma), prisma };
  }

  it('throws NotFoundException when adding a recurring item to a missing contract', async () => {
    const { service, prisma } = buildService();
    prisma.contract.findUnique.mockResolvedValue(null);

    await expect(
      service.addRecurringItem('missing', {
        description: '월 이용료',
        period: 'MONTHLY',
        amount: 100000,
        startDate: '2026-01-01',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('creates a recurring item for an existing contract', async () => {
    const { service, prisma } = buildService();

    const result = await service.addRecurringItem('contract-1', {
      description: '월 이용료',
      period: 'MONTHLY',
      amount: 100000,
      startDate: '2026-01-01',
    });

    expect(result).toEqual({ id: 'item-1', contractId: 'contract-1' });
    expect(prisma.contractRecurringItem.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ contractId: 'contract-1', amount: 100000 }) }),
    );
  });

  it('throws BadRequestException when adding a recurring item to a terminated contract', async () => {
    const { service, prisma } = buildService();
    prisma.contract.findUnique.mockResolvedValue({ ...contract, status: 'TERMINATED' });

    await expect(
      service.addRecurringItem('contract-1', {
        description: '월 이용료',
        period: 'MONTHLY',
        amount: 100000,
        startDate: '2026-01-01',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates an adhoc charge for a terminated contract without throwing', async () => {
    const { service, prisma } = buildService();
    prisma.contract.findUnique.mockResolvedValue({ ...contract, status: 'TERMINATED' });

    const result = await service.addAdhocCharge(
      'contract-1',
      { description: '추가 작업비', amount: 50000, occurredOn: '2026-07-01' },
      'admin-1',
    );

    expect(result).toEqual({ id: 'charge-1', contractId: 'contract-1' });
  });

  it('creates an adhoc charge tagged with the creating admin user', async () => {
    const { service, prisma } = buildService();

    const result = await service.addAdhocCharge(
      'contract-1',
      { description: '추가 작업비', amount: 50000, occurredOn: '2026-07-01' },
      'admin-1',
    );

    expect(result).toEqual({ id: 'charge-1', contractId: 'contract-1' });
    expect(prisma.adhocCharge.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ contractId: 'contract-1', createdByAdminUserId: 'admin-1' }),
      }),
    );
  });
});
