import { ConflictException, NotFoundException } from '@nestjs/common';
import { InvoiceReminderService } from './invoice-reminder.service';

describe('InvoiceReminderService', () => {
  const overdueSentInvoice = {
    id: 'invoice-1',
    status: 'SENT',
    totalAmount: { toString: () => '150000' },
    dueDate: new Date('2020-01-01'), // far in the past relative to any test run
    contract: { customer: { email: 'cust@example.com' } },
  };

  function buildService(overrides: any = {}) {
    const prisma = {
      invoice: {
        findUnique: jest.fn().mockResolvedValue(overdueSentInvoice),
      },
      collectionReminder: {
        create: jest.fn().mockResolvedValue({ id: 'reminder-1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      ...overrides,
    } as any;
    const mailer = { sendInvoice: jest.fn(), sendOverdueReminder: jest.fn().mockResolvedValue(undefined) } as any;

    return { service: new InvoiceReminderService(prisma, mailer), prisma, mailer };
  }

  it('emails a stage-specific overdue reminder for a SENT, past-due invoice', async () => {
    const { service, mailer } = buildService();

    await service.sendReminder('invoice-1', 'FIRST', 'MANUAL', 'admin-1');

    expect(mailer.sendOverdueReminder).toHaveBeenCalledWith(
      expect.objectContaining({ toEmail: 'cust@example.com', invoiceId: 'invoice-1', totalAmount: '150000', stage: 'FIRST' }),
    );
  });

  it('persists a MANUAL CollectionReminder with the sending admin', async () => {
    const { service, prisma } = buildService();

    await service.sendReminder('invoice-1', 'SECOND', 'MANUAL', 'admin-1');

    expect(prisma.collectionReminder.create).toHaveBeenCalledWith({
      data: { invoiceId: 'invoice-1', stage: 'SECOND', triggeredBy: 'MANUAL', sentByAdminUserId: 'admin-1' },
    });
  });

  it('persists an AUTO CollectionReminder with a null admin when no adminUserId is passed', async () => {
    const { service, prisma } = buildService();

    await service.sendReminder('invoice-1', 'FINAL', 'AUTO');

    expect(prisma.collectionReminder.create).toHaveBeenCalledWith({
      data: { invoiceId: 'invoice-1', stage: 'FINAL', triggeredBy: 'AUTO', sentByAdminUserId: null },
    });
  });

  it('throws NotFoundException when the invoice does not exist', async () => {
    const { service, prisma, mailer } = buildService();
    prisma.invoice.findUnique.mockResolvedValue(null);

    await expect(service.sendReminder('missing-invoice', 'FIRST', 'MANUAL', 'admin-1')).rejects.toThrow(NotFoundException);
    expect(mailer.sendOverdueReminder).not.toHaveBeenCalled();
  });

  it('throws ConflictException for a DRAFT invoice (never sent to the customer)', async () => {
    const { service, prisma, mailer } = buildService();
    prisma.invoice.findUnique.mockResolvedValue({ ...overdueSentInvoice, status: 'DRAFT' });

    await expect(service.sendReminder('invoice-1', 'FIRST', 'MANUAL', 'admin-1')).rejects.toThrow(ConflictException);
    expect(mailer.sendOverdueReminder).not.toHaveBeenCalled();
  });

  it('throws ConflictException when the invoice is SENT but not yet overdue', async () => {
    const { service, prisma, mailer } = buildService();
    const farFutureDueDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);
    prisma.invoice.findUnique.mockResolvedValue({ ...overdueSentInvoice, dueDate: farFutureDueDate });

    await expect(service.sendReminder('invoice-1', 'FIRST', 'MANUAL', 'admin-1')).rejects.toThrow(ConflictException);
    expect(mailer.sendOverdueReminder).not.toHaveBeenCalled();
  });

  it('propagates and does not swallow mailer failures, and does not record a reminder', async () => {
    const { service, prisma, mailer } = buildService();
    mailer.sendOverdueReminder.mockRejectedValue(new Error('smtp down'));

    await expect(service.sendReminder('invoice-1', 'FIRST', 'MANUAL', 'admin-1')).rejects.toThrow('smtp down');
    expect(prisma.collectionReminder.create).not.toHaveBeenCalled();
  });

  it('lists reminder history for an invoice, most recent first', async () => {
    const { service, prisma } = buildService();
    prisma.collectionReminder.findMany.mockResolvedValue([{ id: 'reminder-2' }, { id: 'reminder-1' }]);

    const result = await service.listReminders('invoice-1');

    expect(prisma.collectionReminder.findMany).toHaveBeenCalledWith({
      where: { invoiceId: 'invoice-1' },
      include: { sentByAdminUser: true },
      orderBy: { sentAt: 'desc' },
    });
    expect(result).toEqual([{ id: 'reminder-2' }, { id: 'reminder-1' }]);
  });

  it('throws NotFoundException from listReminders when the invoice does not exist', async () => {
    const { service, prisma } = buildService();
    prisma.invoice.findUnique.mockResolvedValue(null);

    await expect(service.listReminders('missing-invoice')).rejects.toThrow(NotFoundException);
  });

  describe('recommendedStage', () => {
    it('returns null for fewer than 7 days overdue', () => {
      expect(InvoiceReminderService.recommendedStage(6)).toBeNull();
    });

    it('returns FIRST for 7-29 days overdue', () => {
      expect(InvoiceReminderService.recommendedStage(7)).toBe('FIRST');
      expect(InvoiceReminderService.recommendedStage(29)).toBe('FIRST');
    });

    it('returns SECOND for 30-59 days overdue', () => {
      expect(InvoiceReminderService.recommendedStage(30)).toBe('SECOND');
      expect(InvoiceReminderService.recommendedStage(59)).toBe('SECOND');
    });

    it('returns FINAL for 60+ days overdue', () => {
      expect(InvoiceReminderService.recommendedStage(60)).toBe('FINAL');
      expect(InvoiceReminderService.recommendedStage(500)).toBe('FINAL');
    });
  });
});
