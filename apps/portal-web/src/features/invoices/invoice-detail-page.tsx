import { useParams } from 'react-router-dom';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { ApiError } from '../../lib/api-client';
import { useDownloadInvoicePdf, useInvoices } from './invoices-api';

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: invoices, isLoading, error } = useInvoices();
  const downloadPdf = useDownloadInvoicePdf();
  const [downloadError, setDownloadError] = useState<string | null>(null);

  if (isLoading) return <p>불러오는 중...</p>;
  if (error || !invoices) return <p className="text-red-600">청구서 정보를 불러오지 못했습니다.</p>;

  const invoice = invoices.find((item) => item.id === id);
  if (!invoice) return <p className="text-red-600">청구서를 찾을 수 없습니다.</p>;

  async function handleDownload() {
    setDownloadError(null);
    try {
      await downloadPdf.mutateAsync(id!);
    } catch (err) {
      setDownloadError(err instanceof ApiError ? err.message : 'PDF 다운로드에 실패했습니다.');
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">청구서 {invoice.id.slice(0, 8)}</h1>
      <p className="text-sm text-slate-600">
        청구 기간: {invoice.periodStart.slice(0, 10)} ~ {invoice.periodEnd.slice(0, 10)} / 납부기한:{' '}
        {invoice.dueDate.slice(0, 10)}
      </p>
      <ul className="space-y-1 text-sm">
        {invoice.lineItems.map((line) => (
          <li key={line.id} className="flex justify-between rounded-md border border-slate-200 p-2">
            <span>{line.description}</span>
            <span>{line.amount}원</span>
          </li>
        ))}
      </ul>
      <p className="font-medium">합계: {invoice.totalAmount}원</p>
      <Button onClick={handleDownload} disabled={downloadPdf.isPending}>
        {downloadPdf.isPending ? '다운로드 중...' : 'PDF 다운로드'}
      </Button>
      {downloadError && <p className="text-sm text-red-600">{downloadError}</p>}
    </div>
  );
}
