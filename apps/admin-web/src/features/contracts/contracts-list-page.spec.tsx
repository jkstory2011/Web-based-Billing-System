import { screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../test/mock-server';
import { renderWithProviders, SALES_TOKEN, ACCOUNTING_TOKEN } from '../../test/render-with-providers';
import { ContractsListPage } from './contracts-list-page';

const API_URL = import.meta.env.VITE_API_URL as string;

function contract(id: string) {
  return {
    id,
    customerId: 'c1',
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: null,
    status: 'ACTIVE',
    recurringItems: [],
    adhocCharges: [],
  };
}

describe('ContractsListPage', () => {
  it('renders contracts and shows the create link for SALES', async () => {
    server.use(
      http.get(`${API_URL}/admin/contracts`, () =>
        HttpResponse.json({ data: [contract('contract-12345678')], total: 1, page: 1, limit: 20 }),
      ),
    );

    renderWithProviders(<ContractsListPage />, { token: SALES_TOKEN });

    await waitFor(() => expect(screen.getByText('활성')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: '새 계약 등록' })).toBeInTheDocument();
  });

  it('hides the create link for ACCOUNTING', async () => {
    server.use(
      http.get(`${API_URL}/admin/contracts`, () =>
        HttpResponse.json({ data: [contract('contract-12345678')], total: 1, page: 1, limit: 20 }),
      ),
    );

    renderWithProviders(<ContractsListPage />, { token: ACCOUNTING_TOKEN });

    await waitFor(() => expect(screen.getByText('활성')).toBeInTheDocument());
    expect(screen.queryByRole('link', { name: '새 계약 등록' })).not.toBeInTheDocument();
  });

  it('moves to the next page and fetches it', async () => {
    server.use(
      http.get(`${API_URL}/admin/contracts`, ({ request }) => {
        const page = new URL(request.url).searchParams.get('page');
        if (page === '2') {
          return HttpResponse.json({ data: [contract('bbbbbbbb-page2')], total: 21, page: 2, limit: 20 });
        }
        return HttpResponse.json({ data: [contract('aaaaaaaa-page1')], total: 21, page: 1, limit: 20 });
      }),
    );

    renderWithProviders(<ContractsListPage />, { token: SALES_TOKEN });

    await waitFor(() => expect(screen.getByRole('link', { name: 'aaaaaaaa' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '다음' }));

    await waitFor(() => expect(screen.getByRole('link', { name: 'bbbbbbbb' })).toBeInTheDocument());
    expect(screen.queryByRole('link', { name: 'aaaaaaaa' })).not.toBeInTheDocument();
  });
});
