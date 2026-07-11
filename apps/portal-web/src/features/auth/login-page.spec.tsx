import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { server } from '../../test/mock-server';
import { AuthProvider, useAuth } from './auth-context';
import { LoginPage } from './login-page';

const API_URL = import.meta.env.VITE_API_URL as string;
const PORTAL_TOKEN =
  'eyJhbGciOiJub25lIn0.eyJzdWIiOiJwb3J0YWwtdXNlci0xIiwiY3VzdG9tZXJJZCI6ImN1c3RvbWVyLTEifQ.';

function AuthedDisplay() {
  const { isAuthenticated } = useAuth();
  return <span data-testid="authed">{String(isAuthenticated)}</span>;
}

describe('LoginPage', () => {
  it('logs in and updates auth state on success', async () => {
    server.use(http.post(`${API_URL}/portal/auth/login`, () => HttpResponse.json({ accessToken: PORTAL_TOKEN })));

    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
          <AuthedDisplay />
        </AuthProvider>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'customer@example.com' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'change-me-please' } });
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));

    await waitFor(() => expect(screen.getByTestId('authed')).toHaveTextContent('true'));
  });

  it('shows the server error message on invalid credentials', async () => {
    server.use(
      http.post(`${API_URL}/portal/auth/login`, () =>
        HttpResponse.json({ statusCode: 401, message: '이메일 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 }),
      ),
    );

    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'customer@example.com' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'wrong-password' } });
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));

    await waitFor(() => expect(screen.getByText('이메일 또는 비밀번호가 올바르지 않습니다.')).toBeInTheDocument());
  });
});
