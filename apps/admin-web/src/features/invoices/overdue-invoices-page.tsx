import { Link, Navigate } from 'react-router-dom';
import { useState } from 'react';
import Decimal from 'decimal.js';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { ApiError } from '../../lib/api-client';
import { useAuth } from '../auth/auth-context';
import { useInvoiceReminders, useInvoices, useSendOverdueReminder } from './invoices-api';
import type { Invoice, ReminderStage } from '../../types/domain';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const STAGE_LABEL: Record<ReminderStage, string> = {
  FIRST: '1차',
  SECOND: '2차',
  FINAL: '최종통보',
};

function recommendedStage(daysOverdue: number): ReminderStage | null {
  if (daysOverdue >= 60) return 'FINAL';
  if (daysOverdue >= 30) return 'SECOND';
  if (daysOverdue >= 7) return 'FIRST';
  return null;
}

function OverdueInvoiceRow({ invoice, daysOverdue }: { invoice: Invoice; daysOverdue: number }) {
  const recommended = recommendedStage(daysOverdue);
  const [stage, setStage] = useState<ReminderStage>(recommended ?? 'FIRST');
  const [showHistory, setShowHistory] = useState(false);
  const sendReminder = useSendOverdueReminder();
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const { data: history } = useInvoiceReminders(invoice.id, { enabled: showHistory });

  async function handleSendReminder() {
    setFeedback(null);
    try {
      await sendReminder.mutateAsync({ id: invoice.id, stage });
      setFeedback({ type: 'success', message: '알림을 발송했습니다.' });
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof ApiError ? err.message : '알림 발송에 실패했습니다.' });
    }
  }

  return (
    <TableRow>
      <TableCell>
        <Link to={`/invoices/${invoice.id}`} className="text-slate-900 underline">
          {invoice.contract?.customer.name ?? invoice.contractId.slice(0, 8)}
        </Link>
      </TableCell>
      <TableCell>
        {invoice.periodStart.slice(0, 10)} ~ {invoice.periodEnd.slice(0, 10)}
      </TableCell>
      <TableCell>{invoice.dueDate.slice(0, 10)}</TableCell>
      <TableCell>{daysOverdue}일</TableCell>
      <TableCell>{new Decimal(invoice.totalAmount).toNumber().toLocaleString('ko-KR')}원</TableCell>
      <TableCell>
        <div className="space-y-1">
          {recommended ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                {STAGE_LABEL[recommended]} 안내 필요
              </span>
              <Label htmlFor={`stage-select-${invoice.id}`} className="sr-only">
                독촉 단계 선택
              </Label>
              <select
                id={`stage-select-${invoice.id}`}
                aria-label="독촉 단계 선택"
                value={stage}
                onChange={(e) => setStage(e.target.value as ReminderStage)}
                className="rounded-md border border-slate-300 text-xs"
              >
                <option value="FIRST">1차</option>
                <option value="SECOND">2차</option>
                <option value="FINAL">최종통보</option>
              </select>
              <Button
                onClick={handleSendReminder}
                disabled={sendReminder.isPending}
                className="bg-slate-200 text-slate-900 hover:bg-slate-300"
              >
                {sendReminder.isPending ? '발송 중...' : '미납 알림 발송'}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-slate-400">아직 독촉 불가 (7일 미만)</p>
          )}
          {feedback && (
            <p className={`text-xs ${feedback.type === 'success' ? 'text-emerald-700' : 'text-red-600'}`}>{feedback.message}</p>
          )}
          <button type="button" onClick={() => setShowHistory((v) => !v)} className="text-xs text-slate-500 underline">
            {showHistory ? '이력 숨기기' : '독촉 이력 보기'}
          </button>
          {showHistory && (
            <ul className="text-xs text-slate-600">
              {(history ?? []).length === 0 && <li>발송 이력이 없습니다.</li>}
              {(history ?? []).map((reminder) => (
                <li key={reminder.id}>
                  {reminder.sentAt.slice(0, 10)} · {STAGE_LABEL[reminder.stage]} ·{' '}
                  {reminder.triggeredBy === 'AUTO' ? '시스템 자동 발송' : (reminder.sentByAdminUser?.email ?? '관리자')}
                </li>
              ))}
            </ul>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

type AgingBucket = 'd0to30' | 'd31to60' | 'd61to90' | 'd90plus';

function bucketOf(daysOverdue: number): AgingBucket {
  if (daysOverdue <= 30) return 'd0to30';
  if (daysOverdue <= 60) return 'd31to60';
  if (daysOverdue <= 90) return 'd61to90';
  return 'd90plus';
}

export function OverdueInvoicesPage() {
  const { role } = useAuth();
  const { data: invoices, isLoading, error } = useInvoices();
  const [bucketFilter, setBucketFilter] = useState<AgingBucket | 'ALL'>('ALL');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  const canAccess = role === 'ACCOUNTING' || role === 'ADMIN';
  if (!canAccess) {
    return <Navigate to="/" replace />;
  }

  if (isLoading) return <p>불러오는 중...</p>;
  if (error) return <p className="text-red-600">청구서 목록을 불러오지 못했습니다.</p>;

  const now = new Date();
  const allOverdue = (invoices ?? [])
    .filter((invoice) => invoice.status === 'SENT' && new Date(invoice.dueDate) < now)
    .map((invoice) => ({
      invoice,
      daysOverdue: Math.floor((now.getTime() - new Date(invoice.dueDate).getTime()) / MS_PER_DAY),
    }));

  if (allOverdue.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">미수금 관리</h1>
        <p className="text-sm text-slate-500">연체된 청구서가 없습니다.</p>
      </div>
    );
  }

  const overdueInvoices = allOverdue
    .filter(({ daysOverdue }) => bucketFilter === 'ALL' || bucketOf(daysOverdue) === bucketFilter)
    .sort((a, b) => (sortDir === 'desc' ? b.daysOverdue - a.daysOverdue : a.daysOverdue - b.daysOverdue));

  const totalOverdue = overdueInvoices.reduce((sum, { invoice }) => sum.plus(new Decimal(invoice.totalAmount)), new Decimal(0));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">미수금 관리</h1>
      <div className="flex items-center gap-3">
        <p className="font-medium">
          총 미수금: {totalOverdue.toNumber().toLocaleString('ko-KR')}원 ({overdueInvoices.length}건)
        </p>
        <Label htmlFor="bucket-filter-select" className="sr-only">
          연체 구간 필터
        </Label>
        <select
          id="bucket-filter-select"
          aria-label="연체 구간 필터"
          value={bucketFilter}
          onChange={(e) => setBucketFilter(e.target.value as AgingBucket | 'ALL')}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
        >
          <option value="ALL">전체 구간</option>
          <option value="d0to30">0-30일</option>
          <option value="d31to60">31-60일</option>
          <option value="d61to90">61-90일</option>
          <option value="d90plus">90일+</option>
        </select>
      </div>
      {overdueInvoices.length === 0 ? (
        <p className="text-sm text-slate-500">해당 구간에 연체된 청구서가 없습니다.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>고객</TableHead>
              <TableHead>청구 기간</TableHead>
              <TableHead>납부기한</TableHead>
              <TableHead>
                <button
                  type="button"
                  onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
                  className="font-medium text-slate-600 underline"
                >
                  연체일수 {sortDir === 'desc' ? '▼' : '▲'}
                </button>
              </TableHead>
              <TableHead>금액</TableHead>
              <TableHead>알림</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {overdueInvoices.map(({ invoice, daysOverdue }) => (
              <OverdueInvoiceRow key={invoice.id} invoice={invoice} daysOverdue={daysOverdue} />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
