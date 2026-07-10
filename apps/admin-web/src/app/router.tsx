import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../features/auth/login-page';
import { ProtectedRoute } from '../features/auth/protected-route';
import { ContractCreatePage } from '../features/contracts/contract-create-page';
import { ContractDetailPage } from '../features/contracts/contract-detail-page';
import { ContractsListPage } from '../features/contracts/contracts-list-page';
import { CustomerCreatePage } from '../features/customers/customer-create-page';
import { CustomerDetailPage } from '../features/customers/customer-detail-page';
import { CustomerEditPage } from '../features/customers/customer-edit-page';
import { CustomersListPage } from '../features/customers/customers-list-page';
import { AppLayout } from './app-layout';
import { DashboardPage } from './dashboard-page';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="/customers" element={<CustomersListPage />} />
            <Route path="/customers/new" element={<CustomerCreatePage />} />
            <Route path="/customers/:id" element={<CustomerDetailPage />} />
            <Route path="/customers/:id/edit" element={<CustomerEditPage />} />
            <Route path="/contracts" element={<ContractsListPage />} />
            <Route path="/contracts/new" element={<ContractCreatePage />} />
            <Route path="/contracts/:id" element={<ContractDetailPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
