import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../test/mock-server';
import { renderWithProviders, ACCOUNTING_TOKEN, SALES_TOKEN } from '../../test/render-with-providers';
import { OverdueInvoicesPage } from './overdue-invoices-page';

const API_URL = import.meta.env.VITE_API_URL as string;

const NOW = new Date('2026-07-11T00:00:00.000Z');

const invoices = [
  {
    id: 'invoice-overdue-1',
    contractId: 'contract-1',
    periodStart: '2026-05-01T00:00:00.000Z',
    periodEnd: '2026-05-31T00:00:00.000Z',
    issueDate: '2026-06-01T00:00:00.000Z',
    dueDate: '2026-06-15T00:00:00.000Z', // 26 days overdue -> recommended FIRST
    status: 'SENT',
    totalAmount: '150000.50',
    contract: { customer: { id: 'c1', name: '연체고객', email: 'c1@example.com' } },
  },
  {
    id: 'invoice-recently-overdue',
    contractId: 'contract-4',
    periodStart: '2026-06-01T00:00:00.000Z',
    periodEnd: '2026-06-30T00:00:00.000Z',
    issueDate: '2026-07-01T00:00:00.000Z',
    dueDate: '2026-07-08T00:00:00.000Z', // 3 days overdue -> no recommended stage
    status: 'SENT',
    totalAmount: '20000',
    contract: { customer: { id: 'c4', name: '최근연체고객', email: 'c4@example.com' } },
  },
  {
    id: 'invoice-not-due-yet',
    contractId: 'contract-2',
    periodStart: '2026-07-01T00:00:00.000Z',
    periodEnd: '2026-07-31T00:00:00.000Z',
    issueDate: '2026-07-05T00:00:00.000Z',
    dueDate: '2026-08-14T00:00:00.000Z',
    status: 'SENT',
    totalAmount: '50000',
    contract: { customer: { id: 'c2', name: '정상고객', email: 'c2@example.com' } },
  },
  {
    id: 'invoice-draft-past-due-conceptually',
    contractId: 'contract-3',
    periodStart: '2026-05-01T00:00:00.000Z',
    periodEnd: '2026-05-31T00:00:00.000Z',
    issueDate: null,
    dueDate: '2026-06-01T00:00:00.000Z',
    status: 'DRAFT',
    totalAmount: '99999.50',
    contract: { customer: { id: 'c3', name: '초안고객', email: 'c3@example.com' } },
  },
  {
    id: 'invoice-very-overdue',
    contractId: 'contract-5',
    periodStart: '2026-02-01T00:00:00.000Z',
    periodEnd: '2026-02-28T00:00:00.000Z',
    issueDate: '2026-03-01T00:00:00.000Z',
    dueDate: '2026-03-01T00:00:00.000Z', // ~132 days overdue -> bucket 90+
    status: 'SENT',
    totalAmount: '10000',
    contract: { customer: { id: 'c5', name: '매우연체고객', email: 'c5@example.com' } },
  },
];

describe('OverdueInvoicesPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lists only SENT invoices past their due date, with days overdue and a precise total', async () => {
    server.use(http.get(`${API_URL}/admin/invoices`, () => HttpResponse.json(invoices)));

    renderWithProviders(
      <Routes>
        <Route path="/invoices/overdue" element={<OverdueInvoicesPage />} />
      </Routes>,
      { token: ACCOUNTING_TOKEN, route: '/invoices/overdue' },
    );

    await waitFor(() => expect(screen.getByText('연체고객')).toBeInTheDocument());

    expect(screen.queryByText('정상고객')).not.toBeInTheDocument();
    expect(screen.queryByText('초안고객')).not.toBeInTheDocument();
    expect(screen.getByText('26일')).toBeInTheDocument();
    expect(screen.getByText('총 미수금: 180,000.5원 (3건)')).toBeInTheDocument();
  });

  it('filters overdue invoices by aging bucket', async () => {
    server.use(http.get(`${API_URL}/admin/invoices`, () => HttpResponse.json(invoices)));

    renderWithProviders(
      <Routes>
        <Route path="/invoices/overdue" element={<OverdueInvoicesPage />} />
      </Routes>,
      { token: ACCOUNTING_TOKEN, route: '/invoices/overdue' },
    );

    await waitFor(() => expect(screen.getByText('매우연체고객')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('연체 구간 필터'), { target: { value: 'd90plus' } });

    expect(screen.getByText('매우연체고객')).toBeInTheDocument();
    expect(screen.queryByText('연체고객')).not.toBeInTheDocument();
    expect(screen.queryByText('최근연체고객')).not.toBeInTheDocument();
  });

  it('sorts overdue invoices by days overdue, descending by default, and toggles on header click', async () => {
    server.use(http.get(`${API_URL}/admin/invoices`, () => HttpResponse.json(invoices)));

    renderWithProviders(
      <Routes>
        <Route path="/invoices/overdue" element={<OverdueInvoicesPage />} />
      </Routes>,
      { token: ACCOUNTING_TOKEN, route: '/invoices/overdue' },
    );

    await waitFor(() => expect(screen.getByText('매우연체고객')).toBeInTheDocument());

    let names = screen.getAllByText(/.+고객$/).map((el) => el.textContent);
    expect(names).toEqual(['매우연체고객', '연체고객', '최근연체고객']);

    fireEvent.click(screen.getByRole('button', { name: /연체일수/ }));

    names = screen.getAllByText(/.+고객$/).map((el) => el.textContent);
    expect(names).toEqual(['최근연체고객', '연체고객', '매우연체고객']);
  });

  it('shows an empty-state message when nothing is overdue', async () => {
    server.use(http.get(`${API_URL}/admin/invoices`, () => HttpResponse.json([invoices[2]])));

    renderWithProviders(
      <Routes>
        <Route path="/invoices/overdue" element={<OverdueInvoicesPage />} />
      </Routes>,
      { token: ACCOUNTING_TOKEN, route: '/invoices/overdue' },
    );

    await waitFor(() => expect(screen.getByText('연체된 청구서가 없습니다.')).toBeInTheDocument());
  });

  it('shows the recommended-stage badge and sends that stage by default', async () => {
    server.use(
      http.get(`${API_URL}/admin/invoices`, () => HttpResponse.json(invoices)),
      http.post(`${API_URL}/admin/invoices/invoice-overdue-1/remind`, async ({ request }) => {
        const body = (await request.json()) as { stage: string };
        expect(body.stage).toBe('FIRST');
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderWithProviders(
      <Routes>
        <Route path="/invoices/overdue" element={<OverdueInvoicesPage />} />
      </Routes>,
      { token: ACCOUNTING_TOKEN, route: '/invoices/overdue' },
    );

    await waitFor(() => expect(screen.getByText('연체고객')).toBeInTheDocument());
    expect(screen.getByText('1차 안내 필요')).toBeInTheDocument();

    // Scope to 연체고객's row specifically — with `invoice-very-overdue` also
    // in the fixture list and sorted first by default (desc days-overdue),
    // an unscoped `getAllByRole(...)[0]` would hit the wrong row.
    const row = screen.getByText('연체고객').closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: '미납 알림 발송' }));

    await waitFor(() => expect(screen.getByText('알림을 발송했습니다.')).toBeInTheDocument());
  });

  it('shows no badge or send controls for an invoice overdue fewer than 7 days', async () => {
    server.use(http.get(`${API_URL}/admin/invoices`, () => HttpResponse.json(invoices)));

    renderWithProviders(
      <Routes>
        <Route path="/invoices/overdue" element={<OverdueInvoicesPage />} />
      </Routes>,
      { token: ACCOUNTING_TOKEN, route: '/invoices/overdue' },
    );

    await waitFor(() => expect(screen.getByText('최근연체고객')).toBeInTheDocument());
    expect(screen.getByText('아직 독촉 불가 (7일 미만)')).toBeInTheDocument();
  });

  it('sends the manually selected stage instead of the recommended one', async () => {
    server.use(
      http.get(`${API_URL}/admin/invoices`, () => HttpResponse.json(invoices)),
      http.post(`${API_URL}/admin/invoices/invoice-overdue-1/remind`, async ({ request }) => {
        const body = (await request.json()) as { stage: string };
        expect(body.stage).toBe('FINAL');
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderWithProviders(
      <Routes>
        <Route path="/invoices/overdue" element={<OverdueInvoicesPage />} />
      </Routes>,
      { token: ACCOUNTING_TOKEN, route: '/invoices/overdue' },
    );

    await waitFor(() => expect(screen.getByText('연체고객')).toBeInTheDocument());
    const row = screen.getByText('연체고객').closest('tr')!;
    fireEvent.change(within(row).getByLabelText('독촉 단계 선택'), { target: { value: 'FINAL' } });
    fireEvent.click(within(row).getByRole('button', { name: '미납 알림 발송' }));

    await waitFor(() => expect(screen.getByText('알림을 발송했습니다.')).toBeInTheDocument());
  });

  it('shows reminder history when toggled', async () => {
    server.use(
      http.get(`${API_URL}/admin/invoices`, () => HttpResponse.json(invoices)),
      http.get(`${API_URL}/admin/invoices/invoice-overdue-1/reminders`, () =>
        HttpResponse.json([
          {
            id: 'reminder-1',
            invoiceId: 'invoice-overdue-1',
            stage: 'FIRST',
            triggeredBy: 'AUTO',
            sentAt: '2026-07-01T00:00:00.000Z',
            sentByAdminUserId: null,
            sentByAdminUser: null,
          },
        ]),
      ),
    );

    renderWithProviders(
      <Routes>
        <Route path="/invoices/overdue" element={<OverdueInvoicesPage />} />
      </Routes>,
      { token: ACCOUNTING_TOKEN, route: '/invoices/overdue' },
    );

    await waitFor(() => expect(screen.getByText('연체고객')).toBeInTheDocument());
    const row = screen.getByText('연체고객').closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: '독촉 이력 보기' }));

    await waitFor(() => expect(screen.getByText(/시스템 자동 발송/)).toBeInTheDocument());
  });

  it('shows an error message when sending the reminder fails', async () => {
    server.use(
      http.get(`${API_URL}/admin/invoices`, () => HttpResponse.json(invoices)),
      http.post(`${API_URL}/admin/invoices/invoice-overdue-1/remind`, () =>
        HttpResponse.json({ statusCode: 409, message: '아직 납부기한이 지나지 않았습니다.' }, { status: 409 }),
      ),
    );

    renderWithProviders(
      <Routes>
        <Route path="/invoices/overdue" element={<OverdueInvoicesPage />} />
      </Routes>,
      { token: ACCOUNTING_TOKEN, route: '/invoices/overdue' },
    );

    await waitFor(() => expect(screen.getByText('연체고객')).toBeInTheDocument());
    const row = screen.getByText('연체고객').closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: '미납 알림 발송' }));

    await waitFor(() => expect(screen.getByText('아직 납부기한이 지나지 않았습니다.')).toBeInTheDocument());
  });

  it('blocks SALES users, even via direct navigation', async () => {
    server.use(http.get(`${API_URL}/admin/invoices`, () => HttpResponse.json(invoices)));

    const { queryClient } = renderWithProviders(
      <Routes>
        <Route path="/invoices/overdue" element={<OverdueInvoicesPage />} />
      </Routes>,
      { token: SALES_TOKEN, route: '/invoices/overdue' },
    );

    await waitFor(() => expect(queryClient.getQueryState(['invoices'])?.status).toBe('success'));

    expect(screen.queryByText('연체고객')).not.toBeInTheDocument();
  });
});
