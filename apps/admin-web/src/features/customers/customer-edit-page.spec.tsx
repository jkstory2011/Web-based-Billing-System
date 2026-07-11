import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { server } from '../../test/mock-server';
import { renderWithProviders, SALES_TOKEN } from '../../test/render-with-providers';
import { CustomerEditPage } from './customer-edit-page';

const API_URL = import.meta.env.VITE_API_URL as string;

function renderEditPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/customers/:id/edit" element={<CustomerEditPage />} />
    </Routes>,
    { token: SALES_TOKEN, route: '/customers/c1/edit' },
  );
}

describe('CustomerEditPage', () => {
  it('shows an error message instead of an infinite spinner when the fetch fails', async () => {
    server.use(http.get(`${API_URL}/admin/customers/c1`, () => HttpResponse.json({ message: '고객을 찾을 수 없습니다.' }, { status: 404 })));

    renderEditPage();

    await waitFor(() => expect(screen.getByText('고객 정보를 불러오지 못했습니다.')).toBeInTheDocument());
    expect(screen.queryByText('불러오는 중...')).not.toBeInTheDocument();
  });
});
