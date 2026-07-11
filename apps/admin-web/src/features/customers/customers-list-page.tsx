import { Link } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { buttonClassName } from '../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { useCustomers } from './customers-api';

const CUSTOMER_TYPE_LABEL: Record<string, string> = { INDIVIDUAL: '개인', COMPANY: '기업' };

export function CustomersListPage() {
  const { role } = useAuth();
  const { data: customers, isLoading, error } = useCustomers();
  const canEdit = role === 'SALES' || role === 'ADMIN';

  if (isLoading) return <p>불러오는 중...</p>;
  if (error) return <p className="text-red-600">고객 목록을 불러오지 못했습니다.</p>;

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
          {customers?.map((customer) => (
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
    </div>
  );
}
