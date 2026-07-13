import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  function buildService(overrides: any = {}) {
    const prisma = {
      systemSettings: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'default', autoReminderEnabled: false }),
        upsert: jest.fn().mockResolvedValue({ id: 'default', autoReminderEnabled: true }),
      },
      ...overrides,
    } as any;
    return { service: new SettingsService(prisma), prisma };
  }

  it('creates the singleton row (disabled by default) on first read if it does not exist', async () => {
    const { service, prisma } = buildService();

    const result = await service.getSettings();

    expect(prisma.systemSettings.create).toHaveBeenCalledWith({ data: { id: 'default', autoReminderEnabled: false } });
    expect(result).toEqual({ id: 'default', autoReminderEnabled: false });
  });

  it('returns the existing row without creating a new one', async () => {
    const { service, prisma } = buildService({
      systemSettings: {
        findUnique: jest.fn().mockResolvedValue({ id: 'default', autoReminderEnabled: true }),
        create: jest.fn(),
      },
    });

    const result = await service.getSettings();

    expect(prisma.systemSettings.create).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'default', autoReminderEnabled: true });
  });

  it('upserts the toggle value', async () => {
    const { service, prisma } = buildService();

    const result = await service.updateSettings(true);

    expect(prisma.systemSettings.upsert).toHaveBeenCalledWith({
      where: { id: 'default' },
      create: { id: 'default', autoReminderEnabled: true },
      update: { autoReminderEnabled: true },
    });
    expect(result.autoReminderEnabled).toBe(true);
  });

  it('isAutoReminderEnabled reflects the current stored value', async () => {
    const { service } = buildService({
      systemSettings: {
        findUnique: jest.fn().mockResolvedValue({ id: 'default', autoReminderEnabled: true }),
        create: jest.fn(),
      },
    });

    await expect(service.isAutoReminderEnabled()).resolves.toBe(true);
  });
});
