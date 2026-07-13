import { Link, useParams } from 'react-router-dom';
import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/auth-context';
import { Button, buttonClassName } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useAdminUsers } from '../admin-users/admin-users-api';
import { useSettings } from '../settings/settings-api';
import { useInvoices } from '../invoices/invoices-api';
import {
  useCollectionNotes,
  useCreateCollectionNote,
  useCreatePortalAccount,
  useCustomer,
  useSetAutoReminderOverride,
  useSetCollectionOwner,
} from './customers-api';
import type { Customer } from '../../types/domain';

function CollectionOwnerSection({ customer }: { customer: Customer }) {
  const { role } = useAuth();
  // Viewing who owns a customer's collections is ACCOUNTING/ADMIN (matches
  // the PATCH endpoint's role). Reassigning it needs the admin roster, and
  // GET /admin/admin-users is ADMIN-only (Task 3) — so only ADMIN gets the
  // picker; ACCOUNTING sees the current owner as read-only text and never
  // calls the admin-users endpoint it isn't allowed to read.
  const canView = role === 'ACCOUNTING' || role === 'ADMIN';
  const canEditRoster = role === 'ADMIN';
  const { data: adminUsers } = useAdminUsers({ enabled: canEditRoster });
  const setOwner = useSetCollectionOwner(customer.id);

  if (!canView) return null;

  return (
    <div className="space-y-2 rounded-md border border-slate-200 p-4">
      <h2 className="text-sm font-semibold">담당자</h2>
      <p className="text-sm text-slate-600">현재 담당자: {customer.collectionOwner?.email ?? '미지정'}</p>
      {canEditRoster && (
        <>
          <Label htmlFor="collection-owner-select">담당자 선택</Label>
          <select
            id="collection-owner-select"
            aria-label="담당자 선택"
            value={customer.collectionOwnerId ?? ''}
            onChange={(e) => setOwner.mutate(e.target.value === '' ? null : e.target.value)}
            disabled={setOwner.isPending}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm"
          >
            <option value="">미지정</option>
            {(adminUsers ?? []).map((admin) => (
              <option key={admin.id} value={admin.id}>
                {admin.email}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  );
}

function AutoReminderOverrideSection({ customer }: { customer: Customer }) {
  const { role } = useAuth();
  const canEdit = role === 'ADMIN';
  const { data: settings } = useSettings({ enabled: canEdit });
  const setOverride = useSetAutoReminderOverride(customer.id);

  if (!canEdit) return null;

  const value = customer.autoReminderOverride === null ? 'FOLLOW' : customer.autoReminderOverride ? 'ON' : 'OFF';

  function handleChange(next: string) {
    if (next === 'FOLLOW') setOverride.mutate(null);
    else if (next === 'ON') setOverride.mutate(true);
    else setOverride.mutate(false);
  }

  return (
    <div className="space-y-2 rounded-md border border-slate-200 p-4">
      <h2 className="text-sm font-semibold">자동 알림 발송</h2>
      <p className="text-sm text-slate-600">시스템 전체 설정: {settings?.autoReminderEnabled ? '켜짐' : '꺼짐'}</p>
      <Label htmlFor="auto-reminder-override-select">자동 알림 발송 설정</Label>
      <select
        id="auto-reminder-override-select"
        aria-label="자동 알림 발송 설정"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        disabled={setOverride.isPending}
        className="rounded-md border border-slate-300 px-2 py-1 text-sm"
      >
        <option value="FOLLOW">시스템 설정 따름</option>
        <option value="ON">항상 켜짐</option>
        <option value="OFF">항상 꺼짐</option>
      </select>
    </div>
  );
}

function CollectionNotesSection({ customerId }: { customerId: string }) {
  const { role } = useAuth();
  const canEdit = role === 'ACCOUNTING' || role === 'ADMIN';
  const { data: notes } = useCollectionNotes(customerId, { enabled: canEdit });
  const { data: invoices } = useInvoices({ enabled: canEdit });
  const createNote = useCreateCollectionNote(customerId);
  const [body, setBody] = useState('');
  const [invoiceId, setInvoiceId] = useState('');

  if (!canEdit) return null;

  const customerInvoices = (invoices ?? []).filter((invoice) => invoice.contract?.customer.id === customerId);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    createNote.mutate(
      { body, invoiceId: invoiceId || undefined },
      {
        onSuccess: () => {
          setBody('');
          setInvoiceId('');
        },
      },
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-slate-200 p-4">
      <h2 className="text-sm font-semibold">메모</h2>
      <form onSubmit={handleSubmit} className="space-y-2">
        <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder="메모를 입력하세요" />
        <Label htmlFor="note-invoice-select">관련 청구서 (선택)</Label>
        <select
          id="note-invoice-select"
          aria-label="관련 청구서 선택"
          value={invoiceId}
          onChange={(e) => setInvoiceId(e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
        >
          <option value="">전체 메모 (특정 청구서 아님)</option>
          {customerInvoices.map((invoice) => (
            <option key={invoice.id} value={invoice.id}>
              {invoice.periodStart.slice(0, 10)} ~ {invoice.periodEnd.slice(0, 10)}
            </option>
          ))}
        </select>
        <Button type="submit" disabled={createNote.isPending}>
          {createNote.isPending ? '저장 중...' : '메모 추가'}
        </Button>
      </form>
      <ul className="space-y-2 text-sm">
        {(notes ?? []).map((note) => (
          <li key={note.id} className="border-t border-slate-100 pt-2">
            <p>{note.body}</p>
            <p className="text-xs text-slate-400">
              {note.authorAdminUser.email} · {note.createdAt.slice(0, 10)}
              {note.invoiceId && (
                <>
                  {' · '}
                  <Link to={`/invoices/${note.invoiceId}`} className="underline">
                    관련 청구서
                  </Link>
                </>
              )}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

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
      <CollectionOwnerSection customer={customer} />
      <AutoReminderOverrideSection customer={customer} />
      <CollectionNotesSection customerId={customer.id} />
    </div>
  );
}
