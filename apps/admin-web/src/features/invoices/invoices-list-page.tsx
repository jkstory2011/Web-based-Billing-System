import { Link, Navigate } from 'react-router-dom';
import { StatusBadge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { useAuth } from '../auth/auth-context';
import { useInvoices } from './invoices-api';

export function InvoicesListPage() {
  const { role } = useAuth();
  const { data: invoices, isLoading, error } = useInvoices();

  // Backend gates the entire /admin/invoices/* section to ACCOUNTING/ADMIN at the
  // controller level (SALES has zero access, not just to generate/issue). This
  // guard avoids showing a dead-end UI to a SALES user who navigates here directly
  // (nav link is hidden, but the route itself must still be blocked) — same pattern
  // as InvoiceGeneratePage.
  const canAccess = role === 'ACCOUNTING' || role === 'ADMIN';
  if (!canAccess) {
    return <Navigate to="/" replace />;
  }

  if (isLoading) return <p>불러오는 중...</p>;
  if (error) return <p className="text-red-600">청구서 목록을 불러오지 못했습니다.</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">청구서 목록</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>고객</TableHead>
            <TableHead>청구 기간</TableHead>
            <TableHead>금액</TableHead>
            <TableHead>상태</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices?.map((invoice) => (
            <TableRow key={invoice.id}>
              <TableCell>
                <Link to={`/invoices/${invoice.id}`} className="text-slate-900 underline">
                  {invoice.contract?.customer.name ?? invoice.contractId.slice(0, 8)}
                </Link>
              </TableCell>
              <TableCell>
                {invoice.periodStart.slice(0, 10)} ~ {invoice.periodEnd.slice(0, 10)}
              </TableCell>
              <TableCell>{invoice.totalAmount}원</TableCell>
              <TableCell>
                <StatusBadge status={invoice.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
