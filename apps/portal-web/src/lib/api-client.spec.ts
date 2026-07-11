import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { server } from '../test/mock-server';
import { apiRequest, ApiError } from './api-client';
import { clearToken, setToken } from './auth-token';

const API_URL = import.meta.env.VITE_API_URL as string;

describe('apiRequest', () => {
  beforeEach(() => {
    clearToken();
  });

  it('attaches the bearer token when one is stored', async () => {
    setToken('token-123');
    let receivedAuth: string | null = null;
    server.use(
      http.get(`${API_URL}/portal/invoices`, ({ request }) => {
        receivedAuth = request.headers.get('authorization');
        return HttpResponse.json([]);
      }),
    );

    await apiRequest('/portal/invoices');

    expect(receivedAuth).toBe('Bearer token-123');
  });

  it('makes no authorization header when no token is stored', async () => {
    let receivedAuth: string | null = 'not-checked-yet';
    server.use(
      http.get(`${API_URL}/portal/invoices`, ({ request }) => {
        receivedAuth = request.headers.get('authorization');
        return HttpResponse.json([]);
      }),
    );

    await apiRequest('/portal/invoices');

    expect(receivedAuth).toBeNull();
  });

  it('throws an ApiError with the joined message on a 400 response', async () => {
    server.use(
      http.post(`${API_URL}/portal/auth/login`, () =>
        HttpResponse.json(
          { statusCode: 400, message: ['email must be an email', 'password must be longer than 8 characters'], error: 'Bad Request' },
          { status: 400 },
        ),
      ),
    );

    const error = await apiRequest('/portal/auth/login', { method: 'POST', body: {} }).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe('email must be an email, password must be longer than 8 characters');
  });

  it('throws an ApiError with status 401 on an unauthorized response', async () => {
    server.use(
      http.get(`${API_URL}/portal/invoices`, () =>
        HttpResponse.json({ statusCode: 401, message: 'Unauthorized' }, { status: 401 }),
      ),
    );

    const error = await apiRequest('/portal/invoices').catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
  });
});
