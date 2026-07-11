import { useParams } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { useContract } from './contracts-api';
import { RecurringItemForm } from './recurring-item-form';
import { AdhocChargeForm } from './adhoc-charge-form';

const PERIOD_LABEL: Record<string, string> = { MONTHLY: '월간', QUARTERLY: '분기' };

export function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { role } = useAuth();
  const { data: contract, isLoading, error } = useContract(id!);
  // Role matrix: 계약 등록·수정 (which includes adding recurring items) is
  // hidden for ACCOUNTING (view-only); 건별청구 입력 stays visible to all roles.
  const canEdit = role === 'SALES' || role === 'ADMIN';

  if (isLoading) return <p>불러오는 중...</p>;
  if (error || !contract) return <p className="text-red-600">계약 정보를 불러오지 못했습니다.</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">계약 {contract.id.slice(0, 8)}</h1>
      <section className="space-y-2">
        <h2 className="font-medium">정액항목</h2>
        <ul className="space-y-1 text-sm">
          {contract.recurringItems.length === 0 && <li className="text-slate-500">등록된 정액항목이 없습니다.</li>}
          {contract.recurringItems.map((item) => (
            <li key={item.id} className="flex justify-between rounded-md border border-slate-200 p-2">
              <span>
                {item.description} ({PERIOD_LABEL[item.period]})
              </span>
              <span>{item.amount}원</span>
            </li>
          ))}
        </ul>
        {canEdit && <RecurringItemForm contractId={contract.id} />}
      </section>
      <section className="space-y-2">
        <h2 className="font-medium">건별청구</h2>
        <ul className="space-y-1 text-sm">
          {contract.adhocCharges.length === 0 && <li className="text-slate-500">등록된 건별청구가 없습니다.</li>}
          {contract.adhocCharges.map((charge) => (
            <li key={charge.id} className="flex justify-between rounded-md border border-slate-200 p-2">
              <span>{charge.description}</span>
              <span>{charge.amount}원</span>
            </li>
          ))}
        </ul>
        <AdhocChargeForm contractId={contract.id} />
      </section>
    </div>
  );
}
