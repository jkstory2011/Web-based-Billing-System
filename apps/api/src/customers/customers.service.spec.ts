import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
        count: jest.fn().mockResolvedValue(1),
      },
      portalUser: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'portal-1', customerId: 'cust-1' }),
      },
      adminUser: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      ...overrides,
    } as any;
    return { service: new CustomersService(prisma), prisma };
  }

  it('returns a page of customers with skip/take derived from page and limit', async () => {
    const { service, prisma } = buildService();

    const result = await service.findAllPaginated(2, 10);

    expect(prisma.customer.findMany).toHaveBeenCalledWith({ skip: 10, take: 10 });
    expect(result).toEqual({ data: [customer], total: 1, page: 2, limit: 10 });
  });

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

  it('throws ConflictException when creating a customer with a duplicate email', async () => {
    const { service, prisma } = buildService({
      customer: {
        create: jest.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('Unique constraint failed on the fields: (`email`)', {
            code: 'P2002',
            clientVersion: '5.0.0',
          }),
        ),
        findMany: jest.fn().mockResolvedValue([customer]),
        findUnique: jest.fn().mockResolvedValue(customer),
        update: jest.fn().mockResolvedValue(customer),
      },
    });

    await expect(
      service.create({ email: 'cust@example.com', name: 'ACME', type: 'COMPANY' } as any),
    ).rejects.toThrow(ConflictException);
  });

  it('includes the collection owner on findOne', async () => {
    const { service, prisma } = buildService({
      customer: {
        findUnique: jest.fn().mockResolvedValue({ ...customer, collectionOwnerId: 'admin-1', collectionOwner: { id: 'admin-1', email: 'a@example.com' } }),
      },
    });

    const result = await service.findOne('cust-1');

    expect(prisma.customer.findUnique).toHaveBeenCalledWith({
      where: { id: 'cust-1' },
      include: { collectionOwner: { select: { id: true, email: true } } },
    });
    expect(result.collectionOwner).toEqual({ id: 'admin-1', email: 'a@example.com' });
  });

  it('sets the collection owner after verifying the admin exists', async () => {
    const { service, prisma } = buildService({
      adminUser: { findUnique: jest.fn().mockResolvedValue({ id: 'admin-1', email: 'a@example.com' }) },
    });

    await service.setCollectionOwner('cust-1', 'admin-1');

    expect(prisma.adminUser.findUnique).toHaveBeenCalledWith({ where: { id: 'admin-1' } });
    expect(prisma.customer.update).toHaveBeenCalledWith({
      where: { id: 'cust-1' },
      data: { collectionOwnerId: 'admin-1' },
      include: { collectionOwner: { select: { id: true, email: true } } },
    });
  });

  it('throws NotFoundException when assigning a non-existent admin as collection owner', async () => {
    const { service, prisma } = buildService({
      adminUser: { findUnique: jest.fn().mockResolvedValue(null) },
    });

    await expect(service.setCollectionOwner('cust-1', 'missing-admin')).rejects.toThrow(NotFoundException);
    expect(prisma.customer.update).not.toHaveBeenCalled();
  });

  it('clears the collection owner when passed null, without checking adminUser', async () => {
    const { service, prisma } = buildService({
      adminUser: { findUnique: jest.fn() },
    });

    await service.setCollectionOwner('cust-1', null);

    expect(prisma.adminUser.findUnique).not.toHaveBeenCalled();
    expect(prisma.customer.update).toHaveBeenCalledWith({
      where: { id: 'cust-1' },
      data: { collectionOwnerId: null },
      include: { collectionOwner: { select: { id: true, email: true } } },
    });
  });

  it('sets the auto-reminder override', async () => {
    const { service, prisma } = buildService();

    await service.setAutoReminderOverride('cust-1', true);

    expect(prisma.customer.update).toHaveBeenCalledWith({
      where: { id: 'cust-1' },
      data: { autoReminderOverride: true },
      include: { collectionOwner: { select: { id: true, email: true } } },
    });
  });

  it('includes the collection owner relation on the auto-reminder-override response, matching findOne/setCollectionOwner', async () => {
    const { service, prisma } = buildService();

    await service.setAutoReminderOverride('cust-1', null);

    expect(prisma.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({ include: { collectionOwner: { select: { id: true, email: true } } } }),
    );
  });
});
