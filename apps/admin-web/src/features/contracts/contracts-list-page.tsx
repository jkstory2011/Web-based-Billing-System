import { Link } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { buttonClassName } from '../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { useContracts } from './contracts-api';

const STATUS_LABEL: Record<string, string> = { ACTIVE: '활성', TERMINATED: '해지' };

export function ContractsListPage() {
  const { role } = useAuth();
  const { data: contracts, isLoading, error } = useContracts();
  const canCreate = role === 'SALES' || role === 'ADMIN';

  if (isLoading) return <p>불러오는 중...</p>;
  if (error) return <p className="text-red-600">계약 목록을 불러오지 못했습니다.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">계약 목록</h1>
        {canCreate && (
          <Link to="/contracts/new" className={buttonClassName}>
            새 계약 등록
          </Link>
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>계약 ID</TableHead>
            <TableHead>시작일</TableHead>
            <TableHead>종료일</TableHead>
            <TableHead>상태</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contracts?.map((contract) => (
            <TableRow key={contract.id}>
              <TableCell>
                <Link to={`/contracts/${contract.id}`} className="text-slate-900 underline">
                  {contract.id.slice(0, 8)}
                </Link>
              </TableCell>
              <TableCell>{contract.startDate.slice(0, 10)}</TableCell>
              <TableCell>{contract.endDate?.slice(0, 10) ?? '-'}</TableCell>
              <TableCell>{STATUS_LABEL[contract.status]}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
