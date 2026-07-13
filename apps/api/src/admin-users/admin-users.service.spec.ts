import { AdminUsersService } from './admin-users.service';

describe('AdminUsersService', () => {
  it('returns admins with only id/email/role, ordered by email', async () => {
    const prisma = {
      adminUser: {
        findMany: jest.fn().mockResolvedValue([{ id: 'a1', email: 'a@example.com', role: 'ADMIN' }]),
      },
    } as any;
    const service = new AdminUsersService(prisma);

    const result = await service.findAll();

    expect(prisma.adminUser.findMany).toHaveBeenCalledWith({
      select: { id: true, email: true, role: true },
      orderBy: { email: 'asc' },
    });
    expect(result).toEqual([{ id: 'a1', email: 'a@example.com', role: 'ADMIN' }]);
  });
});
