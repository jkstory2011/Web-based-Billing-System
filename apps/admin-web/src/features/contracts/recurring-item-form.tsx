import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { z } from 'zod';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { ApiError } from '../../lib/api-client';
import { useAddRecurringItem, type RecurringItemInput } from './contracts-api';

const recurringItemSchema = z.object({
  description: z.string().min(1, '설명을 입력해주세요.'),
  period: z.enum(['MONTHLY', 'QUARTERLY']),
  amount: z.coerce.number().min(0, '금액은 0 이상이어야 합니다.'),
  startDate: z.string().min(1, '시작일을 입력해주세요.'),
  endDate: z.string().optional(),
});

// zod's z.coerce.number() gives the field an input type of `unknown` (it accepts
// anything coercible) and an output type of `number`. useForm's third generic
// tells it the post-resolver (submitted) shape is RecurringItemInput, while the
// first generic — inferred from the schema's input side — is what `register`
// binds the raw, pre-coercion form fields to.
type RecurringItemFormValues = z.input<typeof recurringItemSchema>;

export function RecurringItemForm({ contractId }: { contractId: string }) {
  const addRecurringItem = useAddRecurringItem(contractId);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RecurringItemFormValues, unknown, RecurringItemInput>({
    resolver: zodResolver(recurringItemSchema),
    defaultValues: { period: 'MONTHLY' },
  });

  async function onSubmit(values: RecurringItemInput) {
    setServerError(null);
    try {
      await addRecurringItem.mutateAsync(values);
      reset();
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : '추가에 실패했습니다.');
    }
  }

  return (
    <form onSubmit={handleSubmit((values) => onSubmit(values))} className="space-y-3 rounded-md border border-slate-200 p-4">
      <h2 className="font-medium">정액항목 추가</h2>
      <div className="space-y-1">
        <Label htmlFor="recurring-description">설명</Label>
        <Input id="recurring-description" {...register('description')} />
        {errors.description && <p className="text-sm text-red-600">{errors.description.message}</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor="recurring-period">주기</Label>
        <select
          id="recurring-period"
          {...register('period')}
          className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
        >
          <option value="MONTHLY">월간</option>
          <option value="QUARTERLY">분기</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="recurring-amount">금액</Label>
        <Input id="recurring-amount" type="number" step="0.01" {...register('amount')} />
        {errors.amount && <p className="text-sm text-red-600">{errors.amount.message}</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor="recurring-startDate">시작일</Label>
        <Input id="recurring-startDate" type="date" {...register('startDate')} />
        {errors.startDate && <p className="text-sm text-red-600">{errors.startDate.message}</p>}
      </div>
      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? '추가 중...' : '추가'}
      </Button>
    </form>
  );
}
