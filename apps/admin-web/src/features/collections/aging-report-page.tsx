import { Link, Navigate } from 'react-router-dom';
import Decimal from 'decimal.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { useAuth } from '../auth/auth-context';
import { useAgingReport } from './collections-api';

export function AgingReportPage() {
  const { role } = useAuth();
  const { data: rows, isLoading, error } = useAgingReport();

  const canAccess = role === 'ACCOUNTING' || role === 'ADMIN';
  if (!canAccess) {
    return <Navigate to="/" replace />;
  }

  if (isLoading) return <p>불러오는 중...</p>;
  if (error) return <p className="text-red-600">채권 현황을 불러오지 못했습니다.</p>;

  const summaries = rows ?? [];
  const totals = summaries.reduce(
    (acc, row) => ({
      d0to30: acc.d0to30.plus(row.buckets.d0to30),
      d31to60: acc.d31to60.plus(row.buckets.d31to60),
      d61to90: acc.d61to90.plus(row.buckets.d61to90),
      d90plus: acc.d90plus.plus(row.buckets.d90plus),
    }),
    { d0to30: new Decimal(0), d31to60: new Decimal(0), d61to90: new Decimal(0), d90plus: new Decimal(0) },
  );
  const grandTotal = totals.d0to30.plus(totals.d31to60).plus(totals.d61to90).plus(totals.d90plus);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">채권 현황 (연체 에징)</h1>
      {summaries.length === 0 ? (
        <p className="text-sm text-slate-500">연체된 채권이 없습니다.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>고객</TableHead>
              <TableHead>0-30일</TableHead>
              <TableHead>31-60일</TableHead>
              <TableHead>61-90일</TableHead>
              <TableHead>90일+</TableHead>
              <TableHead>합계</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">전체 합계</TableCell>
              <TableCell>{totals.d0to30.toNumber().toLocaleString('ko-KR')}원</TableCell>
              <TableCell>{totals.d31to60.toNumber().toLocaleString('ko-KR')}원</TableCell>
              <TableCell>{totals.d61to90.toNumber().toLocaleString('ko-KR')}원</TableCell>
              <TableCell>{totals.d90plus.toNumber().toLocaleString('ko-KR')}원</TableCell>
              <TableCell className="font-medium">{grandTotal.toNumber().toLocaleString('ko-KR')}원</TableCell>
            </TableRow>
            {summaries.map((row) => (
              <TableRow key={row.customerId}>
                <TableCell>
                  <Link to={`/customers/${row.customerId}`} className="text-slate-900 underline">
                    {row.customerName}
                  </Link>
                </TableCell>
                <TableCell>{new Decimal(row.buckets.d0to30).toNumber().toLocaleString('ko-KR')}원</TableCell>
                <TableCell>{new Decimal(row.buckets.d31to60).toNumber().toLocaleString('ko-KR')}원</TableCell>
                <TableCell>{new Decimal(row.buckets.d61to90).toNumber().toLocaleString('ko-KR')}원</TableCell>
                <TableCell>{new Decimal(row.buckets.d90plus).toNumber().toLocaleString('ko-KR')}원</TableCell>
                <TableCell className="font-medium">{new Decimal(row.totalOverdue).toNumber().toLocaleString('ko-KR')}원</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
