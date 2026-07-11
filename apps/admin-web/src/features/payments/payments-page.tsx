import { Navigate } from 'react-router-dom';
import { StatusBadge } from '../../components/ui/badge';
import { useAuth } from '../auth/auth-context';

export function PaymentsPage() {
  const { role } = useAuth();

  // Same access boundary as the rest of the financial screens
  // (/invoices/*) — payment integration is ACCOUNTING/ADMIN territory
  // once it exists, so keep the placeholder behind the same guard now.
  const canAccess = role === 'ACCOUNTING' || role === 'ADMIN';
  if (!canAccess) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">결제 연동 (PG)</h1>
        <StatusBadge status="개발중" />
      </div>
      <p className="text-sm text-slate-600">
        온라인 결제(PG) 연동은 아직 준비 중입니다. PG사 선정 및 연동이 완료되면 이 화면에서 결제 상태 확인, 정산 내역 조회 등을
        이용하실 수 있습니다.
      </p>
      <p className="text-sm text-slate-500">
        그동안 청구서 상태는 초안/발송완료로만 관리되며, 미수금은 <span className="font-medium">미수금 관리</span> 메뉴에서
        확인하실 수 있습니다.
      </p>
    </div>
  );
}
