import { Link, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { StatusBadge } from '../../components/ui/badge';
import { PaginationControls } from '../../components/ui/pagination-controls';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { useAuth } from '../auth/auth-context';
import { useInvoicesPaginated } from './invoices-api';

const PAGE_SIZE = 20;

export function InvoicesListPage() {
  const { role } = useAuth();
  const [page, setPage] = useState(1);
  const { data: result, isLoading, error } = useInvoicesPaginated(page, PAGE_SIZE);

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
  if (error || !result) return <p className="text-red-600">청구서 목록을 불러오지 못했습니다.</p>;

  const totalPages = Math.max(1, Math.ceil(result.total / result.limit));

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
          {result.data.map((invoice) => (
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
      <PaginationControls
        page={page}
        totalPages={totalPages}
        onPrev={() => setPage((current) => Math.max(1, current - 1))}
        onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
      />
    </div>
  );
}
