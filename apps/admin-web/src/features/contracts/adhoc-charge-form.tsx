import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { z } from 'zod';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { ApiError } from '../../lib/api-client';
import { useAddAdhocCharge, type AdhocChargeInput } from './contracts-api';

const adhocChargeSchema = z.object({
  description: z.string().min(1, '설명을 입력해주세요.'),
  amount: z.coerce.number().min(0, '금액은 0 이상이어야 합니다.'),
  occurredOn: z.string().min(1, '발생일을 입력해주세요.'),
});

// See recurring-item-form.tsx for why the form's field-value type (input side of
// the coercing schema) is split from the submitted/output type (AdhocChargeInput).
type AdhocChargeFormValues = z.input<typeof adhocChargeSchema>;

export function AdhocChargeForm({ contractId }: { contractId: string }) {
  const addAdhocCharge = useAddAdhocCharge(contractId);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AdhocChargeFormValues, unknown, AdhocChargeInput>({ resolver: zodResolver(adhocChargeSchema) });

  async function onSubmit(values: AdhocChargeInput) {
    setServerError(null);
    try {
      await addAdhocCharge.mutateAsync(values);
      reset();
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : '추가에 실패했습니다.');
    }
  }

  return (
    <form onSubmit={handleSubmit((values) => onSubmit(values))} className="space-y-3 rounded-md border border-slate-200 p-4">
      <h2 className="font-medium">건별청구 추가</h2>
      <div className="space-y-1">
        <Label htmlFor="adhoc-description">설명</Label>
        <Input id="adhoc-description" {...register('description')} />
        {errors.description && <p className="text-sm text-red-600">{errors.description.message}</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor="adhoc-amount">금액</Label>
        <Input id="adhoc-amount" type="number" step="0.01" {...register('amount')} />
        {errors.amount && <p className="text-sm text-red-600">{errors.amount.message}</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor="adhoc-occurredOn">발생일</Label>
        <Input id="adhoc-occurredOn" type="date" {...register('occurredOn')} />
        {errors.occurredOn && <p className="text-sm text-red-600">{errors.occurredOn.message}</p>}
      </div>
      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? '추가 중...' : '추가'}
      </Button>
    </form>
  );
}
