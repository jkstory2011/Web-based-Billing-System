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
      ...overrides,
    } as any;
    const mailer = { sendInvoice: jest.fn(), sendOverdueReminder: jest.fn().mockResolvedValue(undefined) } as any;

    return { service: new InvoiceReminderService(prisma, mailer), prisma, mailer };
  }

  it('emails an overdue reminder for a SENT, past-due invoice', async () => {
    const { service, mailer } = buildService();

    await service.sendReminder('invoice-1');

    expect(mailer.sendOverdueReminder).toHaveBeenCalledWith(
      expect.objectContaining({ toEmail: 'cust@example.com', invoiceId: 'invoice-1', totalAmount: '150000' }),
    );
  });

  it('throws NotFoundException when the invoice does not exist', async () => {
    const { service, prisma, mailer } = buildService();
    prisma.invoice.findUnique.mockResolvedValue(null);

    await expect(service.sendReminder('missing-invoice')).rejects.toThrow(NotFoundException);
    expect(mailer.sendOverdueReminder).not.toHaveBeenCalled();
  });

  it('throws ConflictException for a DRAFT invoice (never sent to the customer)', async () => {
    const { service, prisma, mailer } = buildService();
    prisma.invoice.findUnique.mockResolvedValue({ ...overdueSentInvoice, status: 'DRAFT' });

    await expect(service.sendReminder('invoice-1')).rejects.toThrow(ConflictException);
    expect(mailer.sendOverdueReminder).not.toHaveBeenCalled();
  });

  it('throws ConflictException when the invoice is SENT but not yet overdue', async () => {
    const { service, prisma, mailer } = buildService();
    const farFutureDueDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);
    prisma.invoice.findUnique.mockResolvedValue({ ...overdueSentInvoice, dueDate: farFutureDueDate });

    await expect(service.sendReminder('invoice-1')).rejects.toThrow(ConflictException);
    expect(mailer.sendOverdueReminder).not.toHaveBeenCalled();
  });

  it('propagates and does not swallow mailer failures', async () => {
    const { service, mailer } = buildService();
    mailer.sendOverdueReminder.mockRejectedValue(new Error('smtp down'));

    await expect(service.sendReminder('invoice-1')).rejects.toThrow('smtp down');
  });
});
