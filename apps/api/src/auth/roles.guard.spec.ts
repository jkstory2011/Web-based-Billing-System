import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function buildContext(user: { role?: string } | undefined): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows access when no roles are required', () => {
    const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(buildContext({ role: 'SALES' }))).toBe(true);
  });

  it('allows access when the user role is in the required list', () => {
    const reflector = { getAllAndOverride: () => ['ACCOUNTING', 'ADMIN'] } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(buildContext({ role: 'ACCOUNTING' }))).toBe(true);
  });

  it('denies access when the user role is not in the required list', () => {
    const reflector = { getAllAndOverride: () => ['ACCOUNTING', 'ADMIN'] } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(buildContext({ role: 'SALES' }))).toThrow('이 작업을 수행할 권한이 없습니다.');
  });
});
