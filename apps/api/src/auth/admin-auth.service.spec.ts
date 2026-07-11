import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AdminAuthService } from './admin-auth.service';

jest.mock('bcryptjs');

describe('AdminAuthService', () => {
  const adminUser = { id: 'admin-1', email: 'admin@example.com', passwordHash: 'hash', role: 'ADMIN' };

  function buildService(overrides: Partial<{ findUnique: jest.Mock }> = {}) {
    const prisma = {
      adminUser: { findUnique: overrides.findUnique ?? jest.fn().mockResolvedValue(adminUser) },
    } as any;
    const jwtService = { signAsync: jest.fn().mockResolvedValue('signed-token') } as any;
    const config = { get: jest.fn().mockReturnValue('admin-secret') } as any;
    return { service: new AdminAuthService(prisma, jwtService, config), prisma, jwtService };
  }

  it('returns an access token for valid credentials', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    const { service, jwtService } = buildService();

    const result = await service.validateAndLogin('admin@example.com', 'correct-password');

    expect(result).toEqual({ accessToken: 'signed-token' });
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      { sub: 'admin-1', role: 'ADMIN' },
      { secret: 'admin-secret', expiresIn: '8h' },
    );
  });

  it('throws UnauthorizedException when the user does not exist', async () => {
    const { service } = buildService({ findUnique: jest.fn().mockResolvedValue(null) });

    await expect(service.validateAndLogin('missing@example.com', 'whatever')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException when the password does not match', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    const { service } = buildService();

    await expect(service.validateAndLogin('admin@example.com', 'wrong-password')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
