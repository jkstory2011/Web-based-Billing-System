import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { renderWithProviders, ACCOUNTING_TOKEN, SALES_TOKEN } from '../../test/render-with-providers';
import { PaymentsPage } from './payments-page';

function renderPaymentsPage(token: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/payments" element={<PaymentsPage />} />
    </Routes>,
    { token, route: '/payments' },
  );
}

describe('PaymentsPage', () => {
  it('shows the 개발중 placeholder for ACCOUNTING/ADMIN', () => {
    renderPaymentsPage(ACCOUNTING_TOKEN);

    expect(screen.getByRole('heading', { name: '결제 연동 (PG)' })).toBeInTheDocument();
    expect(screen.getByText('개발중')).toBeInTheDocument();
  });

  it('blocks SALES users, even via direct navigation', () => {
    renderPaymentsPage(SALES_TOKEN);

    expect(screen.queryByRole('heading', { name: '결제 연동 (PG)' })).not.toBeInTheDocument();
  });
});
