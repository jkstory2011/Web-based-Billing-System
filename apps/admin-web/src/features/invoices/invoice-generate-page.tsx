import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useAuth } from '../auth/auth-context';
import { ApiError } from '../../lib/api-client';
import { useGenerateInvoices, usePreviewInvoices, type GeneratePeriodInput } from './invoices-api';

export function InvoiceGeneratePage() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [period, setPeriod] = useState<GeneratePeriodInput>({ periodStart: '', periodEnd: '' });
  const [error, setError] = useState<string | null>(null);
  const preview = usePreviewInvoices();
  const generate = useGenerateInvoices();

  // Backend already 403s SALES on this endpoint; this guard just avoids showing
  // a dead-end UI to a SALES user who navigates here directly (nav link is hidden,
  // but the route itself must still be blocked).
  const canAccess = role === 'ACCOUNTING' || role === 'ADMIN';
  if (!canAccess) {
    return <Navigate to="/" replace />;
  }

  async function handlePreview() {
    setError(null);
    try {
      await preview.mutateAsync(period);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '미리보기에 실패했습니다.');
    }
  }

  async function handleGenerate() {
    setError(null);
    try {
      await generate.mutateAsync(period);
      navigate('/invoices');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '생성에 실패했습니다.');
    }
  }

  const previews = preview.data ?? [];
  const totalLineCount = previews.reduce((sum, p) => sum + p.recurringItems.length + p.adhocCharges.length, 0);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">청구서 생성</h1>
      <div className="flex items-end gap-4">
        <div className="space-y-1">
          <Label htmlFor="periodStart">청구 기간 시작</Label>
          <Input
            id="periodStart"
            type="date"
            value={period.periodStart}
            onChange={(e) => setPeriod((p) => ({ ...p, periodStart: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="periodEnd">청구 기간 종료</Label>
          <Input
            id="periodEnd"
            type="date"
            value={period.periodEnd}
            onChange={(e) => setPeriod((p) => ({ ...p, periodEnd: e.target.value }))}
          />
        </div>
        <Button onClick={handlePreview} disabled={!period.periodStart || !period.periodEnd || preview.isPending}>
          {preview.isPending ? '조회 중...' : '미리보기'}
        </Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {preview.isSuccess && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            대상 계약 {previews.length}건, 청구 항목 {totalLineCount}건
          </p>
          <ul className="space-y-2 text-sm">
            {previews.map((p) => (
              <li key={p.contractId} className="rounded-md border border-slate-200 p-2">
                계약 {p.contractId.slice(0, 8)} — 정액항목 {p.recurringItems.length}건, 건별청구 {p.adhocCharges.length}건
              </li>
            ))}
          </ul>
          <Button onClick={handleGenerate} disabled={previews.length === 0 || generate.isPending}>
            {generate.isPending ? '생성 중...' : '일괄 생성'}
          </Button>
        </div>
      )}
    </div>
  );
}
