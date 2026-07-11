import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { z } from 'zod';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { ApiError } from '../../lib/api-client';
import { useCustomers } from '../customers/customers-api';
import { useCreateContract, type CreateContractInput } from './contracts-api';

const contractSchema = z.object({
  customerId: z.string().min(1, '고객을 선택해주세요.'),
  startDate: z.string().min(1, '시작일을 입력해주세요.'),
  // react-hook-form submits an untouched <input type="date"> as "" rather than
  // undefined, and the backend's @IsOptional() @IsDateString() rejects "" as an
  // invalid date string (IsOptional only treats null/undefined as absent). Coerce
  // the empty string to undefined here so an ongoing contract with no end date
  // round-trips as "field omitted" instead of a 400.
  endDate: z.string().optional().transform((v) => v || undefined),
});

export function ContractCreatePage() {
  const navigate = useNavigate();
  const { data: customers } = useCustomers();
  const createContract = useCreateContract();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateContractInput>({ resolver: zodResolver(contractSchema) });

  async function onSubmit(values: CreateContractInput) {
    setServerError(null);
    try {
      const contract = await createContract.mutateAsync(values);
      navigate(`/contracts/${contract.id}`);
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : '등록에 실패했습니다.');
    }
  }

  return (
    <form onSubmit={handleSubmit((values) => onSubmit(values))} className="max-w-md space-y-4">
      <h1 className="text-xl font-semibold">새 계약 등록</h1>
      <div className="space-y-1">
        <Label htmlFor="customerId">고객</Label>
        <select
          id="customerId"
          {...register('customerId')}
          className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
        >
          <option value="">선택해주세요</option>
          {customers?.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
        {errors.customerId && <p className="text-sm text-red-600">{errors.customerId.message}</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor="startDate">시작일</Label>
        <Input id="startDate" type="date" {...register('startDate')} />
        {errors.startDate && <p className="text-sm text-red-600">{errors.startDate.message}</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor="endDate">종료일 (선택)</Label>
        <Input id="endDate" type="date" {...register('endDate')} />
      </div>
      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? '등록 중...' : '등록'}
      </Button>
    </form>
  );
}
