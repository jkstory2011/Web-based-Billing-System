import { screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { server } from '../../test/mock-server';
import { renderWithProviders, ACCOUNTING_TOKEN, ADMIN_TOKEN, SALES_TOKEN } from '../../test/render-with-providers';
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
  collectionOwnerId: null,
  collectionOwner: null,
  autoReminderOverride: null,
};

function renderDetailPage(token: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/customers/:id" element={<CustomerDetailPage />} />
    </Routes>,
    { token, route: '/customers/c1' },
  );
}

describe('CustomerDetailPage', () => {
  it('issues a portal account and shows the temporary credentials', async () => {
    server.use(
      http.get(`${API_URL}/admin/customers/c1`, () => HttpResponse.json(customer)),
      http.post(`${API_URL}/admin/customers/c1/portal-account`, () =>
        HttpResponse.json({ email: 'hong@example.com', temporaryPassword: 'temp-pass-123' }),
      ),
    );

    renderDetailPage(SALES_TOKEN);

    await waitFor(() => expect(screen.getByRole('heading', { name: '홍길동' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '포털 계정 발급' }));

    await waitFor(() => expect(screen.getByText(/temp-pass-123/)).toBeInTheDocument());
  });

  it('hides the edit link and portal-issue button for ACCOUNTING (view-only role)', async () => {
    server.use(
      http.get(`${API_URL}/admin/customers/c1`, () => HttpResponse.json(customer)),
      http.get(`${API_URL}/admin/customers/c1/collection-notes`, () => HttpResponse.json([])),
      http.get(`${API_URL}/admin/invoices`, () => HttpResponse.json([])),
    );

    renderDetailPage(ACCOUNTING_TOKEN);

    await waitFor(() => expect(screen.getByRole('heading', { name: '홍길동' })).toBeInTheDocument());

    expect(screen.queryByRole('link', { name: '정보 수정' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '포털 계정 발급' })).not.toBeInTheDocument();
  });

  it('shows the current collection owner as read-only text for ACCOUNTING (no admin-users list call)', async () => {
    server.use(
      http.get(`${API_URL}/admin/customers/c1`, () =>
        HttpResponse.json({ ...customer, collectionOwnerId: 'admin-1', collectionOwner: { id: 'admin-1', email: 'accounting@example.com', role: 'ACCOUNTING' } }),
      ),
      http.get(`${API_URL}/admin/customers/c1/collection-notes`, () => HttpResponse.json([])),
      http.get(`${API_URL}/admin/invoices`, () => HttpResponse.json([])),
    );

    renderDetailPage(ACCOUNTING_TOKEN);

    await waitFor(() => expect(screen.getByText(/accounting@example.com/)).toBeInTheDocument());
    expect(screen.queryByLabelText('담당자 선택')).not.toBeInTheDocument();
  });

  it('lets ADMIN assign a collection owner from the admin-users list', async () => {
    server.use(
      http.get(`${API_URL}/admin/customers/c1`, () => HttpResponse.json(customer)),
      http.get(`${API_URL}/admin/admin-users`, () =>
        HttpResponse.json([{ id: 'admin-1', email: 'accounting@example.com', role: 'ACCOUNTING' }]),
      ),
      http.get(`${API_URL}/admin/customers/c1/collection-notes`, () => HttpResponse.json([])),
      http.get(`${API_URL}/admin/invoices`, () => HttpResponse.json([])),
      http.get(`${API_URL}/admin/settings`, () => HttpResponse.json({ autoReminderEnabled: false })),
      http.patch(`${API_URL}/admin/customers/c1/collection-owner`, () =>
        HttpResponse.json({ ...customer, collectionOwnerId: 'admin-1', collectionOwner: { id: 'admin-1', email: 'accounting@example.com', role: 'ACCOUNTING' } }),
      ),
    );

    renderDetailPage(ADMIN_TOKEN);

    await waitFor(() => expect(screen.getByText('담당자')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('담당자 선택'), { target: { value: 'admin-1' } });

    await waitFor(() => expect(screen.getByText(/accounting@example.com/)).toBeInTheDocument());
  });

  it('shows the auto-reminder override control with the current global setting, only for ADMIN', async () => {
    server.use(
      http.get(`${API_URL}/admin/customers/c1`, () => HttpResponse.json(customer)),
      http.get(`${API_URL}/admin/admin-users`, () => HttpResponse.json([])),
      http.get(`${API_URL}/admin/customers/c1/collection-notes`, () => HttpResponse.json([])),
      http.get(`${API_URL}/admin/invoices`, () => HttpResponse.json([])),
      http.get(`${API_URL}/admin/settings`, () => HttpResponse.json({ autoReminderEnabled: true })),
    );

    renderDetailPage(ADMIN_TOKEN);

    await waitFor(() => expect(screen.getByText('자동 알림 발송')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('시스템 전체 설정: 켜짐')).toBeInTheDocument());
  });

  it('hides the auto-reminder override control for ACCOUNTING', async () => {
    server.use(
      http.get(`${API_URL}/admin/customers/c1`, () => HttpResponse.json(customer)),
      http.get(`${API_URL}/admin/customers/c1/collection-notes`, () => HttpResponse.json([])),
      http.get(`${API_URL}/admin/invoices`, () => HttpResponse.json([])),
    );

    renderDetailPage(ACCOUNTING_TOKEN);

    await waitFor(() => expect(screen.getByText('담당자')).toBeInTheDocument());
    expect(screen.queryByText('자동 알림 발송')).not.toBeInTheDocument();
  });

  it('adds a customer-wide collection note and shows it in the timeline', async () => {
    server.use(
      http.get(`${API_URL}/admin/customers/c1`, () => HttpResponse.json(customer)),
      http.get(`${API_URL}/admin/admin-users`, () => HttpResponse.json([])),
      http.get(`${API_URL}/admin/customers/c1/collection-notes`, () => HttpResponse.json([])),
      http.get(`${API_URL}/admin/invoices`, () => HttpResponse.json([])),
      http.get(`${API_URL}/admin/settings`, () => HttpResponse.json({ autoReminderEnabled: false })),
      http.post(`${API_URL}/admin/customers/c1/collection-notes`, () =>
        HttpResponse.json({
          id: 'note-1',
          customerId: 'c1',
          invoiceId: null,
          authorAdminUserId: 'admin-1',
          authorAdminUser: { id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' },
          body: '연락함',
          createdAt: '2026-07-13T00:00:00.000Z',
        }),
      ),
    );

    renderDetailPage(ADMIN_TOKEN);

    await waitFor(() => expect(screen.getByText('메모')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('메모를 입력하세요'), { target: { value: '연락함' } });
    fireEvent.click(screen.getByRole('button', { name: '메모 추가' }));

    await waitFor(() => expect(screen.getByText('연락함')).toBeInTheDocument());
  });

  it('shows a link to the tagged invoice for an invoice-specific note', async () => {
    server.use(
      http.get(`${API_URL}/admin/customers/c1`, () => HttpResponse.json(customer)),
      http.get(`${API_URL}/admin/admin-users`, () => HttpResponse.json([])),
      http.get(`${API_URL}/admin/invoices`, () => HttpResponse.json([])),
      http.get(`${API_URL}/admin/settings`, () => HttpResponse.json({ autoReminderEnabled: false })),
      http.get(`${API_URL}/admin/customers/c1/collection-notes`, () =>
        HttpResponse.json([
          {
            id: 'note-1',
            customerId: 'c1',
            invoiceId: 'invoice-1',
            authorAdminUserId: 'admin-1',
            authorAdminUser: { id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' },
            body: '분할 합의',
            createdAt: '2026-07-13T00:00:00.000Z',
          },
        ]),
      ),
    );

    renderDetailPage(ADMIN_TOKEN);

    await waitFor(() => expect(screen.getByText('분할 합의')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: '관련 청구서' })).toHaveAttribute('href', '/invoices/invoice-1');
  });
});
