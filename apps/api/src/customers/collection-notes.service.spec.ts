import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CollectionNotesService } from './collection-notes.service';

describe('CollectionNotesService', () => {
  function buildService(overrides: any = {}) {
    const prisma = {
      customer: { findUnique: jest.fn().mockResolvedValue({ id: 'cust-1' }) },
      invoice: { findUnique: jest.fn() },
      collectionNote: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'note-1' }),
      },
      ...overrides,
    } as any;
    return { service: new CollectionNotesService(prisma), prisma };
  }

  it('lists notes for a customer, most recent first', async () => {
    const { service, prisma } = buildService();

    await service.listForCustomer('cust-1');

    expect(prisma.collectionNote.findMany).toHaveBeenCalledWith({
      where: { customerId: 'cust-1' },
      include: { authorAdminUser: true, invoice: true },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('throws NotFoundException listing notes for a missing customer', async () => {
    const { service, prisma } = buildService({ customer: { findUnique: jest.fn().mockResolvedValue(null) } });

    await expect(service.listForCustomer('missing')).rejects.toThrow(NotFoundException);
  });

  it('creates a customer-wide note (no invoiceId)', async () => {
    const { service, prisma } = buildService();

    await service.create('cust-1', { body: '연락함' }, 'admin-1');

    expect(prisma.collectionNote.create).toHaveBeenCalledWith({
      data: { customerId: 'cust-1', invoiceId: null, authorAdminUserId: 'admin-1', body: '연락함' },
      include: { authorAdminUser: true, invoice: true },
    });
  });

  it('creates an invoice-tagged note when the invoice belongs to the customer', async () => {
    const { service, prisma } = buildService({
      invoice: { findUnique: jest.fn().mockResolvedValue({ id: 'inv-1', contract: { customerId: 'cust-1' } }) },
    });

    await service.create('cust-1', { body: '분할 합의', invoiceId: 'inv-1' }, 'admin-1');

    expect(prisma.collectionNote.create).toHaveBeenCalledWith({
      data: { customerId: 'cust-1', invoiceId: 'inv-1', authorAdminUserId: 'admin-1', body: '분할 합의' },
      include: { authorAdminUser: true, invoice: true },
    });
  });

  it('includes the author and invoice relations on the create response, matching listForCustomer', async () => {
    const { service, prisma } = buildService();

    await service.create('cust-1', { body: '연락함' }, 'admin-1');

    expect(prisma.collectionNote.create).toHaveBeenCalledWith(
      expect.objectContaining({ include: { authorAdminUser: true, invoice: true } }),
    );
  });

  it('throws BadRequestException when the invoice belongs to a different customer', async () => {
    const { service, prisma } = buildService({
      invoice: { findUnique: jest.fn().mockResolvedValue({ id: 'inv-1', contract: { customerId: 'other-customer' } }) },
    });

    await expect(service.create('cust-1', { body: 'x', invoiceId: 'inv-1' }, 'admin-1')).rejects.toThrow(BadRequestException);
    expect(prisma.collectionNote.create).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when the tagged invoice does not exist', async () => {
    const { service, prisma } = buildService({ invoice: { findUnique: jest.fn().mockResolvedValue(null) } });

    await expect(service.create('cust-1', { body: 'x', invoiceId: 'missing-invoice' }, 'admin-1')).rejects.toThrow(
      BadRequestException,
    );
  });
});
