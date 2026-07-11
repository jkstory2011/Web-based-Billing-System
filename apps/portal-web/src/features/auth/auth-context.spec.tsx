import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearToken } from '../../lib/auth-token';
import { AuthProvider, useAuth } from './auth-context';

// header {"alg":"none"}, payload {"sub":"portal-user-1","customerId":"customer-1"}, no signature
const PORTAL_TOKEN =
  'eyJhbGciOiJub25lIn0.eyJzdWIiOiJwb3J0YWwtdXNlci0xIiwiY3VzdG9tZXJJZCI6ImN1c3RvbWVyLTEifQ.';

function TestConsumer() {
  const { customerId, isAuthenticated, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="customerId">{customerId ?? 'none'}</span>
      <span data-testid="authed">{String(isAuthenticated)}</span>
      <button onClick={() => login(PORTAL_TOKEN)}>login</button>
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

  it('decodes the customerId from the token on login', () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByText('login'));

    expect(screen.getByTestId('customerId')).toHaveTextContent('customer-1');
    expect(screen.getByTestId('authed')).toHaveTextContent('true');
  });

  it('clears the customerId on logout', () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByText('login'));
    fireEvent.click(screen.getByText('logout'));

    expect(screen.getByTestId('customerId')).toHaveTextContent('none');
    expect(screen.getByTestId('authed')).toHaveTextContent('false');
  });
});
