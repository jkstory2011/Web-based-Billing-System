import { Link, Navigate } from 'react-router-dom';
import Decimal from 'decimal.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { useAuth } from '../auth/auth-context';
import { useInvoices } from './invoices-api';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function OverdueInvoicesPage() {
  const { role } = useAuth();
  const { data: invoices, isLoading, error } = useInvoices();

  // Same access boundary as the rest of /invoices/* — backend gates the whole
  // section to ACCOUNTING/ADMIN, SALES has zero access.
  const canAccess = role === 'ACCOUNTING' || role === 'ADMIN';
  if (!canAccess) {
    return <Navigate to="/" replace />;
  }

  if (isLoading) return <p>불러오는 중...</p>;
  if (error) return <p className="text-red-600">청구서 목록을 불러오지 못했습니다.</p>;

  const now = new Date();
  // "연체" has no dedicated backend status yet — Invoice.status is only
  // DRAFT|SENT (no PAID, since payment collection isn't integrated). An
  // invoice counts as overdue once it's been sent to the customer (SENT)
  // and its due date has passed; DRAFT invoices haven't been billed yet so
  // they're excluded even if their due date is in the past.
  const overdueInvoices = (invoices ?? [])
    .filter((invoice) => invoice.status === 'SENT' && new Date(invoice.dueDate) < now)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const totalOverdue = overdueInvoices.reduce((sum, invoice) => sum.plus(new Decimal(invoice.totalAmount)), new Decimal(0));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">미수금 관리</h1>
      {overdueInvoices.length === 0 ? (
        <p className="text-sm text-slate-500">연체된 청구서가 없습니다.</p>
      ) : (
        <>
          <p className="font-medium">
            총 미수금: {totalOverdue.toNumber().toLocaleString('ko-KR')}원 ({overdueInvoices.length}건)
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>고객</TableHead>
                <TableHead>청구 기간</TableHead>
                <TableHead>납부기한</TableHead>
                <TableHead>연체일수</TableHead>
                <TableHead>금액</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overdueInvoices.map((invoice) => {
                const daysOverdue = Math.floor((now.getTime() - new Date(invoice.dueDate).getTime()) / MS_PER_DAY);
                return (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <Link to={`/invoices/${invoice.id}`} className="text-slate-900 underline">
                        {invoice.contract?.customer.name ?? invoice.contractId.slice(0, 8)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {invoice.periodStart.slice(0, 10)} ~ {invoice.periodEnd.slice(0, 10)}
                    </TableCell>
                    <TableCell>{invoice.dueDate.slice(0, 10)}</TableCell>
                    <TableCell>{daysOverdue}일</TableCell>
                    <TableCell>{new Decimal(invoice.totalAmount).toNumber().toLocaleString('ko-KR')}원</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  );
}
