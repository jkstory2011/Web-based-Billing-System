import { screen, fireEvent } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, beforeEach } from 'vitest';
import { clearToken } from '../lib/auth-token';
import { renderWithProviders, ADMIN_TOKEN } from '../test/render-with-providers';
import { AppLayout } from './app-layout';

describe('AppLayout', () => {
  beforeEach(() => clearToken());

  it('shows the current role and clears the token on logout', () => {
    renderWithProviders(
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<div>content</div>} />
        </Route>
      </Routes>,
      { token: ADMIN_TOKEN },
    );

    expect(screen.getByText('ADMIN')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '로그아웃' }));

    expect(localStorage.getItem('admin_access_token')).toBeNull();
  });
});
