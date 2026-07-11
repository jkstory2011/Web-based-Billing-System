import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../test/mock-server';
import { renderWithProviders, SALES_TOKEN, ACCOUNTING_TOKEN } from '../../test/render-with-providers';
import { CustomersListPage } from './customers-list-page';

const API_URL = import.meta.env.VITE_API_URL as string;

const customers = [
  {
    id: 'c1',
    type: 'INDIVIDUAL',
    name: '홍길동',
    email: 'hong@example.com',
    phone: '010-1111-2222',
    businessRegNo: null,
    createdAt: '',
    updatedAt: '',
  },
];

describe('CustomersListPage', () => {
  it('renders customers and shows the create link for SALES', async () => {
    server.use(http.get(`${API_URL}/admin/customers`, () => HttpResponse.json(customers)));

    renderWithProviders(<CustomersListPage />, { token: SALES_TOKEN });

    await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: '새 고객 등록' })).toBeInTheDocument();
  });

  it('hides the create link for ACCOUNTING (view-only)', async () => {
    server.use(http.get(`${API_URL}/admin/customers`, () => HttpResponse.json(customers)));

    renderWithProviders(<CustomersListPage />, { token: ACCOUNTING_TOKEN });

    await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument());
    expect(screen.queryByRole('link', { name: '새 고객 등록' })).not.toBeInTheDocument();
  });
});
