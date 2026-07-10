import { screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { server } from '../../test/mock-server';
import { renderWithProviders, SALES_TOKEN } from '../../test/render-with-providers';
import { ContractCreatePage } from './contract-create-page';

const API_URL = import.meta.env.VITE_API_URL as string;

describe('ContractCreatePage', () => {
  it('creates a contract for the selected customer and navigates to its detail page', async () => {
    server.use(
      http.get(`${API_URL}/admin/customers`, () =>
        HttpResponse.json([
          { id: 'c1', type: 'INDIVIDUAL', name: '홍길동', email: 'hong@example.com', phone: null, businessRegNo: null, createdAt: '', updatedAt: '' },
        ]),
      ),
      http.post(`${API_URL}/admin/contracts`, () =>
        HttpResponse.json({ id: 'contract-1', customerId: 'c1', startDate: '2026-07-01', endDate: null, status: 'ACTIVE', recurringItems: [], adhocCharges: [] }),
      ),
    );

    renderWithProviders(
      <Routes>
        <Route path="/contracts/new" element={<ContractCreatePage />} />
        <Route path="/contracts/:id" element={<div>계약 상세</div>} />
      </Routes>,
      { token: SALES_TOKEN, route: '/contracts/new' },
    );

    await waitFor(() => expect(screen.getByRole('option', { name: '홍길동' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('고객'), { target: { value: 'c1' } });
    fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2026-07-01' } });
    fireEvent.click(screen.getByRole('button', { name: '등록' }));

    await waitFor(() => expect(screen.getByText('계약 상세')).toBeInTheDocument());
  });
});
