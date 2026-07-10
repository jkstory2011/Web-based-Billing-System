import { Link, useParams } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../auth/auth-context';
import { Button, buttonClassName } from '../../components/ui/button';
import { useCreatePortalAccount, useCustomer } from './customers-api';

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { role } = useAuth();
  const { data: customer, isLoading, error } = useCustomer(id!);
  const createPortalAccount = useCreatePortalAccount(id!);
  const [portalResult, setPortalResult] = useState<{ email: string; temporaryPassword: string } | null>(null);
  const canEdit = role === 'SALES' || role === 'ADMIN';

  if (isLoading) return <p>불러오는 중...</p>;
  if (error || !customer) return <p className="text-red-600">고객 정보를 불러오지 못했습니다.</p>;

  return (
    <div className="max-w-md space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{customer.name}</h1>
        {canEdit && (
          <Link to={`/customers/${id}/edit`} className={buttonClassName}>
            정보 수정
          </Link>
        )}
      </div>
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-500">이메일</dt>
          <dd>{customer.email}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">연락처</dt>
          <dd>{customer.phone ?? '-'}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">사업자번호</dt>
          <dd>{customer.businessRegNo ?? '-'}</dd>
        </div>
      </dl>
      {canEdit && (
        <Button
          onClick={() => createPortalAccount.mutate(undefined, { onSuccess: (result) => setPortalResult(result) })}
          disabled={createPortalAccount.isPending}
        >
          {createPortalAccount.isPending ? '발급 중...' : '포털 계정 발급'}
        </Button>
      )}
      {portalResult && (
        <p className="rounded-md bg-slate-100 p-3 text-sm">
          포털 이메일: {portalResult.email} / 임시 비밀번호: {portalResult.temporaryPassword}
        </p>
      )}
    </div>
  );
}
