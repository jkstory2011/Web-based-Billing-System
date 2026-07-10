import { ConflictException, NotFoundException } from '@nestjs/common';
import { CustomersService } from './customers.service';

describe('CustomersService', () => {
  const customer = { id: 'cust-1', email: 'cust@example.com', name: 'ACME', type: 'COMPANY' };

  function buildService(overrides: any = {}) {
    const prisma = {
      customer: {
        create: jest.fn().mockResolvedValue(customer),
        findMany: jest.fn().mockResolvedValue([customer]),
        findUnique: jest.fn().mockResolvedValue(customer),
        update: jest.fn().mockResolvedValue(customer),
      },
      portalUser: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'portal-1', customerId: 'cust-1' }),
      },
      ...overrides,
    } as any;
    return { service: new CustomersService(prisma), prisma };
  }

  it('throws NotFoundException when the customer does not exist', async () => {
    const { service, prisma } = buildService();
    prisma.customer.findUnique.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('creates a portal account with a generated temporary password', async () => {
    const { service, prisma } = buildService();

    const result = await service.createPortalAccount('cust-1');

    expect(result.email).toBe('cust@example.com');
    expect(result.temporaryPassword).toEqual(expect.any(String));
    expect(prisma.portalUser.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ customerId: 'cust-1' }) }),
    );
  });

  it('throws ConflictException when a portal account already exists', async () => {
    const { service, prisma } = buildService({
      portalUser: {
        findUnique: jest.fn().mockResolvedValue({ id: 'portal-1', customerId: 'cust-1' }),
        create: jest.fn(),
      },
    });

    await expect(service.createPortalAccount('cust-1')).rejects.toThrow(ConflictException);
  });
});
