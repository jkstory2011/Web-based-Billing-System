import { Link } from 'react-router-dom';
import { useInvoices } from './invoices-api';

export function InvoicesListPage() {
  const { data: invoices, isLoading, error } = useInvoices();

  if (isLoading) return <p>불러오는 중...</p>;
  if (error || !invoices) return <p className="text-red-600">청구서 목록을 불러오지 못했습니다.</p>;

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">청구서 목록</h1>
      {invoices.length === 0 ? (
        <p className="text-sm text-slate-500">발행된 청구서가 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {invoices.map((invoice) => (
            <li key={invoice.id}>
              <Link
                to={`/invoices/${invoice.id}`}
                className="flex items-center justify-between rounded-md border border-slate-200 p-3 hover:bg-slate-50"
              >
                <span>
                  청구 기간: {invoice.periodStart.slice(0, 10)} ~ {invoice.periodEnd.slice(0, 10)}
                </span>
                <span className="font-medium">{invoice.totalAmount}원</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
