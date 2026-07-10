import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearToken } from '../../lib/auth-token';
import { AuthProvider, useAuth } from './auth-context';

// header {"alg":"none"}, payload {"sub":"admin-1","role":"ADMIN"}, no signature
const ADMIN_TOKEN = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJhZG1pbi0xIiwicm9sZSI6IkFETUlOIn0.';

function TestConsumer() {
  const { role, isAuthenticated, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="role">{role ?? 'none'}</span>
      <span data-testid="authed">{String(isAuthenticated)}</span>
      <button onClick={() => login(ADMIN_TOKEN)}>login</button>
      <button onClick={logout}>logout</button>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => clearToken());

  it('starts unauthenticated when no token is stored', () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    expect(screen.getByTestId('authed')).toHaveTextContent('false');
  });

  it('decodes the role from the token on login', () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByText('login'));

    expect(screen.getByTestId('role')).toHaveTextContent('ADMIN');
    expect(screen.getByTestId('authed')).toHaveTextContent('true');
  });

  it('clears the role on logout', () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByText('login'));
    fireEvent.click(screen.getByText('logout'));

    expect(screen.getByTestId('role')).toHaveTextContent('none');
    expect(screen.getByTestId('authed')).toHaveTextContent('false');
  });
});
