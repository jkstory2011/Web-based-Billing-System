import { Button } from './button';

export function PaginationControls({
  page,
  totalPages,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between text-sm text-slate-600">
      <span>
        {page} / {totalPages} 페이지
      </span>
      <div className="flex gap-2">
        <Button
          onClick={onPrev}
          disabled={page <= 1}
          className="bg-slate-200 text-slate-900 hover:bg-slate-300"
        >
          이전
        </Button>
        <Button
          onClick={onNext}
          disabled={page >= totalPages}
          className="bg-slate-200 text-slate-900 hover:bg-slate-300"
        >
          다음
        </Button>
      </div>
    </div>
  );
}
