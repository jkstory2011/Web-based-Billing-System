import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../auth/auth-context';
import { buttonClassName } from '../../components/ui/button';
import { PaginationControls } from '../../components/ui/pagination-controls';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { useCustomersPaginated } from './customers-api';

const CUSTOMER_TYPE_LABEL: Record<string, string> = { INDIVIDUAL: '개인', COMPANY: '기업' };
const PAGE_SIZE = 20;

export function CustomersListPage() {
  const { role } = useAuth();
  const [page, setPage] = useState(1);
  const { data: result, isLoading, error } = useCustomersPaginated(page, PAGE_SIZE);
  const canEdit = role === 'SALES' || role === 'ADMIN';

  if (isLoading) return <p>불러오는 중...</p>;
  if (error || !result) return <p className="text-red-600">고객 목록을 불러오지 못했습니다.</p>;

  const totalPages = Math.max(1, Math.ceil(result.total / result.limit));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">고객 목록</h1>
        {canEdit && (
          <Link to="/customers/new" className={buttonClassName}>
            새 고객 등록
          </Link>
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>이름</TableHead>
            <TableHead>구분</TableHead>
            <TableHead>이메일</TableHead>
            <TableHead>연락처</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.data.map((customer) => (
            <TableRow key={customer.id}>
              <TableCell>
                <Link to={`/customers/${customer.id}`} className="text-slate-900 underline">
                  {customer.name}
                </Link>
              </TableCell>
              <TableCell>{CUSTOMER_TYPE_LABEL[customer.type]}</TableCell>
              <TableCell>{customer.email}</TableCell>
              <TableCell>{customer.phone ?? '-'}</TableCell>
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
