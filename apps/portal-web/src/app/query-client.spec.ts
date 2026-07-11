import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/api-client';
import { createAppQueryClient } from './query-client';

describe('createAppQueryClient', () => {
  it('calls onUnauthorized when a query fails with a 401 ApiError', async () => {
    const onUnauthorized = vi.fn();
    const queryClient = createAppQueryClient(onUnauthorized);

    await queryClient
      .fetchQuery({
        queryKey: ['test'],
        queryFn: () => {
          throw new ApiError(401, '인증이 만료되었습니다.');
        },
      })
      .catch(() => undefined);

    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('does not call onUnauthorized for non-401 errors', async () => {
    const onUnauthorized = vi.fn();
    const queryClient = createAppQueryClient(onUnauthorized);

    await queryClient
      .fetchQuery({
        queryKey: ['test-2'],
        queryFn: () => {
          throw new ApiError(500, '서버 오류');
        },
      })
      .catch(() => undefined);

    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
