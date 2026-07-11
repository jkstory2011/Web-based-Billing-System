import { type HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-amber-100 text-amber-800',
  SENT: 'bg-emerald-100 text-emerald-800',
};

const STATUS_LABEL: Record<string, string> = { DRAFT: '초안', SENT: '발송완료' };

export function StatusBadge({ status, className, ...props }: { status: string } & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
        STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-700',
        className,
      )}
      {...props}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
