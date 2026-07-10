import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../test/mock-server';
import { renderWithProviders, SALES_TOKEN, ACCOUNTING_TOKEN } from '../../test/render-with-providers';
import { ContractsListPage } from './contracts-list-page';

const API_URL = import.meta.env.VITE_API_URL as string;

const contracts = [
  {
    id: 'contract-12345678',
    customerId: 'c1',
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: null,
    status: 'ACTIVE',
    recurringItems: [],
    adhocCharges: [],
  },
];

describe('ContractsListPage', () => {
  it('renders contracts and shows the create link for SALES', async () => {
    server.use(http.get(`${API_URL}/admin/contracts`, () => HttpResponse.json(contracts)));

    renderWithProviders(<ContractsListPage />, { token: SALES_TOKEN });

    await waitFor(() => expect(screen.getByText('활성')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: '새 계약 등록' })).toBeInTheDocument();
  });

  it('hides the create link for ACCOUNTING', async () => {
    server.use(http.get(`${API_URL}/admin/contracts`, () => HttpResponse.json(contracts)));

    renderWithProviders(<ContractsListPage />, { token: ACCOUNTING_TOKEN });

    await waitFor(() => expect(screen.getByText('활성')).toBeInTheDocument());
    expect(screen.queryByRole('link', { name: '새 계약 등록' })).not.toBeInTheDocument();
  });
});
