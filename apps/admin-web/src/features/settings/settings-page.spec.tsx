import { screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { server } from '../../test/mock-server';
import { renderWithProviders, ADMIN_TOKEN, ACCOUNTING_TOKEN } from '../../test/render-with-providers';
import { SettingsPage } from './settings-page';

const API_URL = import.meta.env.VITE_API_URL as string;

function renderSettingsPage(token: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>,
    { token, route: '/settings' },
  );
}

describe('SettingsPage', () => {
  it('shows the current toggle state for ADMIN', async () => {
    server.use(http.get(`${API_URL}/admin/settings`, () => HttpResponse.json({ autoReminderEnabled: false })));

    renderSettingsPage(ADMIN_TOKEN);

    await waitFor(() => expect(screen.getByRole('button', { name: '꺼짐' })).toBeInTheDocument());
  });

  it('toggles the setting on click', async () => {
    server.use(
      http.get(`${API_URL}/admin/settings`, () => HttpResponse.json({ autoReminderEnabled: false })),
      http.patch(`${API_URL}/admin/settings`, () => HttpResponse.json({ autoReminderEnabled: true })),
    );

    renderSettingsPage(ADMIN_TOKEN);

    await waitFor(() => expect(screen.getByRole('button', { name: '꺼짐' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '꺼짐' }));

    await waitFor(() => expect(screen.getByRole('button', { name: '켜짐' })).toBeInTheDocument());
  });

  it('blocks non-ADMIN roles, even via direct navigation', () => {
    renderSettingsPage(ACCOUNTING_TOKEN);

    expect(screen.queryByRole('heading', { name: '설정' })).not.toBeInTheDocument();
  });
});
