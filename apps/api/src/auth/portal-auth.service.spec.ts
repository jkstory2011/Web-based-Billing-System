import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PortalAuthService } from './portal-auth.service';

jest.mock('bcryptjs');

describe('PortalAuthService', () => {
  const customer = {
    id: 'cust-1',
    email: 'cust@example.com',
    portalUser: { id: 'portal-1', passwordHash: 'hash' },
  };

  function buildService(overrides: any = {}) {
    const prisma = { customer: { findUnique: jest.fn().mockResolvedValue(customer) }, ...overrides } as any;
    const jwtService = { signAsync: jest.fn().mockResolvedValue('portal-token') } as any;
    const config = { get: jest.fn().mockReturnValue('portal-secret') } as any;
    return { service: new PortalAuthService(prisma, jwtService, config), prisma, jwtService };
  }

  it('returns an access token for valid credentials', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    const { service, jwtService } = buildService();

    const result = await service.validateAndLogin('cust@example.com', 'correct-password');

    expect(result).toEqual({ accessToken: 'portal-token' });
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      { sub: 'portal-1', customerId: 'cust-1' },
      { secret: 'portal-secret', expiresIn: '8h' },
    );
  });

  it('throws UnauthorizedException when the customer has no portal account', async () => {
    const { service } = buildService({
      customer: { findUnique: jest.fn().mockResolvedValue({ ...customer, portalUser: null }) },
    });

    await expect(service.validateAndLogin('cust@example.com', 'whatever')).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when the password does not match', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    const { service } = buildService();

    await expect(service.validateAndLogin('cust@example.com', 'wrong-password')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
