import { screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { server } from '../../test/mock-server';
import { renderWithProviders, SALES_TOKEN, ACCOUNTING_TOKEN } from '../../test/render-with-providers';
import { ContractDetailPage } from './contract-detail-page';

const API_URL = import.meta.env.VITE_API_URL as string;

const contract = {
  id: 'contract-1',
  customerId: 'c1',
  startDate: '2026-01-01T00:00:00.000Z',
  endDate: null,
  status: 'ACTIVE',
  recurringItems: [],
  adhocCharges: [],
};

describe('ContractDetailPage', () => {
  it('adds a recurring item and shows it in the list', async () => {
    server.use(
      http.get(`${API_URL}/admin/contracts/contract-1`, () => HttpResponse.json(contract)),
      http.post(`${API_URL}/admin/contracts/contract-1/recurring-items`, () =>
        HttpResponse.json({
          id: 'item-1',
          contractId: 'contract-1',
          description: '월 이용료',
          period: 'MONTHLY',
          amount: '100000',
          startDate: '2026-07-01',
          endDate: null,
        }),
      ),
    );

    renderWithProviders(
      <Routes>
        <Route path="/contracts/:id" element={<ContractDetailPage />} />
      </Routes>,
      { token: SALES_TOKEN, route: '/contracts/contract-1' },
    );

    await waitFor(() => expect(screen.getByText('등록된 정액항목이 없습니다.')).toBeInTheDocument());

    // Both the recurring-item and adhoc-charge forms render a "설명"/"금액"/"추가"
    // label — the recurring form is first in the DOM, so index 0 targets it.
    fireEvent.change(screen.getAllByLabelText('설명')[0], { target: { value: '월 이용료' } });
    fireEvent.change(screen.getAllByLabelText('금액')[0], { target: { value: '100000' } });
    fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2026-07-01' } });
    fireEvent.click(screen.getAllByRole('button', { name: '추가' })[0]);

    await waitFor(() => expect(screen.getByText(/월 이용료/)).toBeInTheDocument());
  });

  it('hides the recurring-item form but keeps the adhoc-charge form for ACCOUNTING', async () => {
    server.use(http.get(`${API_URL}/admin/contracts/contract-1`, () => HttpResponse.json(contract)));

    renderWithProviders(
      <Routes>
        <Route path="/contracts/:id" element={<ContractDetailPage />} />
      </Routes>,
      { token: ACCOUNTING_TOKEN, route: '/contracts/contract-1' },
    );

    await waitFor(() => expect(screen.getByText('등록된 정액항목이 없습니다.')).toBeInTheDocument());

    expect(screen.queryByText('정액항목 추가')).not.toBeInTheDocument();
    expect(screen.getByText('건별청구 추가')).toBeInTheDocument();
    expect(screen.getByLabelText('설명')).toBeInTheDocument();
  });
});
