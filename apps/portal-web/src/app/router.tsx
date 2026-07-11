import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../features/auth/login-page';
import { ProtectedRoute } from '../features/auth/protected-route';
import { InvoiceDetailPage } from '../features/invoices/invoice-detail-page';
import { InvoicesListPage } from '../features/invoices/invoices-list-page';
import { AppLayout } from './app-layout';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<InvoicesListPage />} />
            <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
