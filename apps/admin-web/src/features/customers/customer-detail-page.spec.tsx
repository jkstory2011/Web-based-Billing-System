import { screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { server } from '../../test/mock-server';
import { renderWithProviders, SALES_TOKEN } from '../../test/render-with-providers';
import { CustomerDetailPage } from './customer-detail-page';

const API_URL = import.meta.env.VITE_API_URL as string;

const customer = {
  id: 'c1',
  type: 'INDIVIDUAL',
  name: '홍길동',
  email: 'hong@example.com',
  phone: null,
  businessRegNo: null,
  createdAt: '',
  updatedAt: '',
};

describe('CustomerDetailPage', () => {
  it('issues a portal account and shows the temporary credentials', async () => {
    server.use(
      http.get(`${API_URL}/admin/customers/c1`, () => HttpResponse.json(customer)),
      http.post(`${API_URL}/admin/customers/c1/portal-account`, () =>
        HttpResponse.json({ email: 'hong@example.com', temporaryPassword: 'temp-pass-123' }),
      ),
    );

    renderWithProviders(
      <Routes>
        <Route path="/customers/:id" element={<CustomerDetailPage />} />
      </Routes>,
      { token: SALES_TOKEN, route: '/customers/c1' },
    );

    await waitFor(() => expect(screen.getByRole('heading', { name: '홍길동' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '포털 계정 발급' }));

    await waitFor(() => expect(screen.getByText(/temp-pass-123/)).toBeInTheDocument());
  });
});
