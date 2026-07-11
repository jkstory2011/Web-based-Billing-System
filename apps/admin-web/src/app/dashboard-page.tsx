import { Link } from 'react-router-dom';
import Decimal from 'decimal.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { useAuth } from '../features/auth/auth-context';
import { useInvoices } from '../features/invoices/invoices-api';
import type { Invoice } from '../types/domain';

function sumAmount(invoices: Invoice[]): Decimal {
  return invoices.reduce((sum, invoice) => sum.plus(new Decimal(invoice.totalAmount)), new Decimal(0));
}

function formatWon(amount: Decimal): string {
  return `${amount.toNumber().toLocaleString('ko-KR')}원`;
}

function FinancialSummary({ invoices }: { invoices: Invoice[] }) {
  const sentInvoices = invoices.filter((invoice) => invoice.status === 'SENT');
  const draftInvoices = invoices.filter((invoice) => invoice.status === 'DRAFT');

  const monthlyTotals = new Map<string, { count: number; amount: Decimal }>();
  for (const invoice of sentInvoices) {
    const month = invoice.periodStart.slice(0, 7);
    const existing = monthlyTotals.get(month) ?? { count: 0, amount: new Decimal(0) };
    monthlyTotals.set(month, { count: existing.count + 1, amount: existing.amount.plus(invoice.totalAmount) });
  }
  const monthlyRows = [...monthlyTotals.entries()].sort(([a], [b]) => b.localeCompare(a));

  const customerTotals = new Map<string, Decimal>();
  for (const invoice of sentInvoices) {
    const name = invoice.contract?.customer.name ?? invoice.contractId.slice(0, 8);
    customerTotals.set(name, (customerTotals.get(name) ?? new Decimal(0)).plus(invoice.totalAmount));
  }
  const topCustomerRows = [...customerTotals.entries()].sort(([, a], [, b]) => b.comparedTo(a)).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">총 청구서</p>
          <p className="text-xl font-semibold">{invoices.length}건</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">발송완료 총액</p>
          <p className="text-xl font-semibold">{formatWon(sumAmount(sentInvoices))}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">초안 총액</p>
          <p className="text-xl font-semibold">{formatWon(sumAmount(draftInvoices))}</p>
        </div>
      </div>

      <Link to="/invoices/overdue" className="inline-block text-sm text-slate-700 underline">
        미수금 관리 바로가기
      </Link>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">월별 매출 (발송완료 기준)</h2>
        {monthlyRows.length === 0 ? (
          <p className="text-sm text-slate-500">발송된 청구서가 없습니다.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>월</TableHead>
                <TableHead>건수</TableHead>
                <TableHead>금액</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyRows.map(([month, { count, amount }]) => (
                <TableRow key={month}>
                  <TableCell>{month}</TableCell>
                  <TableCell>{count}건</TableCell>
                  <TableCell>{formatWon(amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">고객별 매출 Top 5</h2>
        {topCustomerRows.length === 0 ? (
          <p className="text-sm text-slate-500">발송된 청구서가 없습니다.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>고객</TableHead>
                <TableHead>금액</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topCustomerRows.map(([name, amount]) => (
                <TableRow key={name}>
                  <TableCell>{name}</TableCell>
                  <TableCell>{formatWon(amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { role } = useAuth();
  const canViewFinancials = role === 'ACCOUNTING' || role === 'ADMIN';
  const { data: invoices, isLoading, error } = useInvoices({ enabled: canViewFinancials });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">청구 시스템 관리자 대시보드</h1>
      {!canViewFinancials && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">영업 담당자 메뉴</h2>
          <p className="text-sm text-slate-600">고객과 계약을 관리하려면 상단 메뉴를 이용하세요.</p>
        </div>
      )}
      {canViewFinancials && isLoading && <p>불러오는 중...</p>}
      {canViewFinancials && error && <p className="text-red-600">청구 데이터를 불러오지 못했습니다.</p>}
      {canViewFinancials && invoices && <FinancialSummary invoices={invoices} />}
    </div>
  );
}
