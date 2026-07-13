import { ReminderSchedulerService } from './reminder-scheduler.service';

describe('ReminderSchedulerService', () => {
  const dayMs = 1000 * 60 * 60 * 24;

  function overdueInvoice(daysOverdue: number, overrides: any = {}) {
    return {
      id: 'invoice-1',
      dueDate: new Date(Date.now() - daysOverdue * dayMs),
      contract: { customer: { id: 'cust-1', autoReminderOverride: null } },
      ...overrides,
    };
  }

  function buildService(overrides: any = {}) {
    const prisma = {
      invoice: { findMany: jest.fn().mockResolvedValue([]) },
      collectionReminder: { findFirst: jest.fn().mockResolvedValue(null) },
      ...overrides,
    } as any;
    const settingsService = { isAutoReminderEnabled: jest.fn().mockResolvedValue(true) } as any;
    const invoiceReminderService = { sendReminder: jest.fn().mockResolvedValue(undefined) } as any;
    return {
      service: new ReminderSchedulerService(prisma, settingsService, invoiceReminderService),
      prisma,
      settingsService,
      invoiceReminderService,
    };
  }

  it('sends the recommended stage for an overdue invoice with no reminder yet', async () => {
    const { service, invoiceReminderService } = buildService({
      invoice: { findMany: jest.fn().mockResolvedValue([overdueInvoice(10)]) },
    });

    await service.runDailyReminders();

    expect(invoiceReminderService.sendReminder).toHaveBeenCalledWith('invoice-1', 'FIRST', 'AUTO');
  });

  it('skips invoices with fewer than 7 days overdue (no recommended stage)', async () => {
    const { service, invoiceReminderService } = buildService({
      invoice: { findMany: jest.fn().mockResolvedValue([overdueInvoice(3)]) },
    });

    await service.runDailyReminders();

    expect(invoiceReminderService.sendReminder).not.toHaveBeenCalled();
  });

  it('skips a stage that was already sent, manually or automatically', async () => {
    const { service, invoiceReminderService } = buildService({
      invoice: { findMany: jest.fn().mockResolvedValue([overdueInvoice(10)]) },
      collectionReminder: { findFirst: jest.fn().mockResolvedValue({ id: 'reminder-1' }) },
    });

    await service.runDailyReminders();

    expect(invoiceReminderService.sendReminder).not.toHaveBeenCalled();
  });

  it('honors a customer-level override even when the global setting is off', async () => {
    const { service, settingsService, invoiceReminderService } = buildService({
      invoice: {
        findMany: jest
          .fn()
          .mockResolvedValue([overdueInvoice(10, { contract: { customer: { id: 'cust-1', autoReminderOverride: true } } })]),
      },
    });
    settingsService.isAutoReminderEnabled.mockResolvedValue(false);

    await service.runDailyReminders();

    expect(invoiceReminderService.sendReminder).toHaveBeenCalled();
  });

  it('skips a customer whose override is explicitly false, even if the global setting is on', async () => {
    const { service, invoiceReminderService } = buildService({
      invoice: {
        findMany: jest
          .fn()
          .mockResolvedValue([overdueInvoice(10, { contract: { customer: { id: 'cust-1', autoReminderOverride: false } } })]),
      },
    });

    await service.runDailyReminders();

    expect(invoiceReminderService.sendReminder).not.toHaveBeenCalled();
  });

  it('isolates a per-invoice failure so remaining invoices still get processed', async () => {
    const invoices = [overdueInvoice(10, { id: 'invoice-1' }), overdueInvoice(10, { id: 'invoice-2' })];
    const { service, invoiceReminderService } = buildService({
      invoice: { findMany: jest.fn().mockResolvedValue(invoices) },
    });
    invoiceReminderService.sendReminder.mockRejectedValueOnce(new Error('smtp down')).mockResolvedValueOnce(undefined);

    await service.runDailyReminders();

    expect(invoiceReminderService.sendReminder).toHaveBeenCalledTimes(2);
  });

  it('does not query anything when the global setting is off and no invoice has an override', async () => {
    const { service, invoiceReminderService } = buildService({
      invoice: { findMany: jest.fn().mockResolvedValue([overdueInvoice(10)]) },
    });
    // default settingsService mock already resolves true; override to false for this case
    (service as any).settingsService.isAutoReminderEnabled = jest.fn().mockResolvedValue(false);

    await service.runDailyReminders();

    expect(invoiceReminderService.sendReminder).not.toHaveBeenCalled();
  });
});
