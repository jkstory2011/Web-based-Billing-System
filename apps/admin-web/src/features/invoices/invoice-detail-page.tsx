import { useParams, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { StatusBadge } from '../../components/ui/badge';
import { ApiError } from '../../lib/api-client';
import { useAuth } from '../auth/auth-context';
import { useDownloadInvoicePdf, useInvoice, useIssueInvoice } from './invoices-api';

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { role } = useAuth();
  const { data: invoice, isLoading, error } = useInvoice(id!);
  const issueInvoice = useIssueInvoice(id!);
  const downloadPdf = useDownloadInvoicePdf();
  const [issueError, setIssueError] = useState<string | null>(null);

  // Backend gates the entire /admin/invoices/* section to ACCOUNTING/ADMIN at the
  // controller level (SALES has zero access, not just to generate/issue). This
  // guard avoids showing a dead-end UI to a SALES user who navigates here directly
  // (nav link is hidden, but the route itself must still be blocked) — same pattern
  // as InvoiceGeneratePage and InvoicesListPage.
  const canAccess = role === 'ACCOUNTING' || role === 'ADMIN';
  if (!canAccess) {
    return <Navigate to="/" replace />;
  }

  if (isLoading) return <p>불러오는 중...</p>;
  if (error || !invoice) return <p className="text-red-600">청구서 정보를 불러오지 못했습니다.</p>;

  async function handleIssue() {
    setIssueError(null);
    try {
      await issueInvoice.mutateAsync();
    } catch (err) {
      setIssueError(err instanceof ApiError ? err.message : '발행에 실패했습니다.');
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">청구서 {invoice.id.slice(0, 8)}</h1>
        <StatusBadge status={invoice.status} />
      </div>
      <p className="text-sm text-slate-600">
        청구 기간: {invoice.periodStart.slice(0, 10)} ~ {invoice.periodEnd.slice(0, 10)} / 납부기한:{' '}
        {invoice.dueDate.slice(0, 10)}
      </p>
      <ul className="space-y-1 text-sm">
        {invoice.lineItems?.map((line) => (
          <li key={line.id} className="flex justify-between rounded-md border border-slate-200 p-2">
            <span>{line.description}</span>
            <span>{line.amount}원</span>
          </li>
        ))}
      </ul>
      <p className="font-medium">합계: {invoice.totalAmount}원</p>
      <div className="flex gap-3">
        {invoice.status === 'DRAFT' && (
          <Button onClick={handleIssue} disabled={issueInvoice.isPending}>
            {issueInvoice.isPending ? '발행 중...' : '발행 (PDF 생성 + 메일 발송)'}
          </Button>
        )}
        {invoice.status === 'SENT' && (
          <Button onClick={() => downloadPdf.mutate(invoice.id)} disabled={downloadPdf.isPending}>
            {downloadPdf.isPending ? '다운로드 중...' : 'PDF 다운로드'}
          </Button>
        )}
      </div>
      {issueError && <p className="text-sm text-red-600">{issueError}</p>}
      {issueInvoice.isSuccess && <p className="text-sm text-emerald-700">발행이 완료되어 이메일로 발송되었습니다.</p>}
    </div>
  );
}
