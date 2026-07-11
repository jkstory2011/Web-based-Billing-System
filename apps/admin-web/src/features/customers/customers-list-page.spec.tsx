import { screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../test/mock-server';
import { renderWithProviders, SALES_TOKEN, ACCOUNTING_TOKEN } from '../../test/render-with-providers';
import { CustomersListPage } from './customers-list-page';

const API_URL = import.meta.env.VITE_API_URL as string;

function customer(id: string, name: string) {
  return {
    id,
    type: 'INDIVIDUAL',
    name,
    email: `${id}@example.com`,
    phone: '010-1111-2222',
    businessRegNo: null,
    createdAt: '',
    updatedAt: '',
  };
}

describe('CustomersListPage', () => {
  it('renders customers and shows the create link for SALES', async () => {
    server.use(
      http.get(`${API_URL}/admin/customers`, () =>
        HttpResponse.json({ data: [customer('c1', '홍길동')], total: 1, page: 1, limit: 20 }),
      ),
    );

    renderWithProviders(<CustomersListPage />, { token: SALES_TOKEN });

    await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: '새 고객 등록' })).toBeInTheDocument();
  });

  it('hides the create link for ACCOUNTING (view-only)', async () => {
    server.use(
      http.get(`${API_URL}/admin/customers`, () =>
        HttpResponse.json({ data: [customer('c1', '홍길동')], total: 1, page: 1, limit: 20 }),
      ),
    );

    renderWithProviders(<CustomersListPage />, { token: ACCOUNTING_TOKEN });

    await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument());
    expect(screen.queryByRole('link', { name: '새 고객 등록' })).not.toBeInTheDocument();
  });

  it('moves to the next page and fetches it', async () => {
    server.use(
      http.get(`${API_URL}/admin/customers`, ({ request }) => {
        const page = new URL(request.url).searchParams.get('page');
        if (page === '2') {
          return HttpResponse.json({ data: [customer('c2', '김철수')], total: 21, page: 2, limit: 20 });
        }
        return HttpResponse.json({ data: [customer('c1', '홍길동')], total: 21, page: 1, limit: 20 });
      }),
    );

    renderWithProviders(<CustomersListPage />, { token: SALES_TOKEN });

    await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '다음' }));

    await waitFor(() => expect(screen.getByText('김철수')).toBeInTheDocument());
    expect(screen.queryByText('홍길동')).not.toBeInTheDocument();
  });
});
