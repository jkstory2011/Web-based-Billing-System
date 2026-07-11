import { screen, fireEvent } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, beforeEach } from 'vitest';
import { clearToken } from '../lib/auth-token';
import { renderWithProviders, PORTAL_TOKEN } from '../test/render-with-providers';
import { AppLayout } from './app-layout';

describe('AppLayout', () => {
  beforeEach(() => clearToken());

  it('clears the token on logout', () => {
    renderWithProviders(
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<div>content</div>} />
        </Route>
      </Routes>,
      { token: PORTAL_TOKEN },
    );

    fireEvent.click(screen.getByRole('button', { name: '로그아웃' }));

    expect(localStorage.getItem('portal_access_token')).toBeNull();
  });
});
