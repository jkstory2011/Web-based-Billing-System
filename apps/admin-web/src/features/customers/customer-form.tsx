import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import type { Customer } from '../../types/domain';
import type { CustomerInput } from './customers-api';

const customerSchema = z.object({
  type: z.enum(['INDIVIDUAL', 'COMPANY']),
  name: z.string().min(1, '이름을 입력해주세요.'),
  businessRegNo: z.string().optional(),
  email: z.string().email('올바른 이메일 형식이 아닙니다.'),
  phone: z.string().optional(),
});

interface CustomerFormProps {
  defaultValues?: Partial<Customer>;
  onSubmit: (values: CustomerInput) => Promise<void>;
  submitLabel: string;
  serverError?: string | null;
}

export function CustomerForm({ defaultValues, onSubmit, submitLabel, serverError }: CustomerFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CustomerInput>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      type: defaultValues?.type ?? 'INDIVIDUAL',
      name: defaultValues?.name ?? '',
      businessRegNo: defaultValues?.businessRegNo ?? '',
      email: defaultValues?.email ?? '',
      phone: defaultValues?.phone ?? '',
    },
  });

  return (
    <form onSubmit={handleSubmit((values) => onSubmit(values))} className="max-w-md space-y-4">
      <div className="space-y-1">
        <Label htmlFor="type">구분</Label>
        <select id="type" {...register('type')} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm">
          <option value="INDIVIDUAL">개인</option>
          <option value="COMPANY">기업</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="name">이름</Label>
        <Input id="name" {...register('name')} />
        {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor="businessRegNo">사업자번호</Label>
        <Input id="businessRegNo" {...register('businessRegNo')} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="email">이메일</Label>
        <Input id="email" type="email" {...register('email')} />
        {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor="phone">연락처</Label>
        <Input id="phone" {...register('phone')} />
      </div>
      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? '저장 중...' : submitLabel}
      </Button>
    </form>
  );
}
