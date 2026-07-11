import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { apiRequest, ApiError } from '../../lib/api-client';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useAuth } from './auth-context';

const loginSchema = z.object({
  email: z.string().email('올바른 이메일 형식이 아닙니다.'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginFormValues) {
    setServerError(null);
    try {
      const { accessToken } = await apiRequest<{ accessToken: string }>('/portal/auth/login', {
        method: 'POST',
        body: values,
      });
      login(accessToken);
      navigate('/', { replace: true });
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : '로그인에 실패했습니다.');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto mt-24 w-full max-w-sm space-y-4">
      <h1 className="text-2xl font-semibold">고객 포털 로그인</h1>
      <div className="space-y-1">
        <Label htmlFor="email">이메일</Label>
        <Input id="email" type="email" {...register('email')} />
        {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor="password">비밀번호</Label>
        <Input id="password" type="password" {...register('password')} />
        {errors.password && <p className="text-sm text-red-600">{errors.password.message}</p>}
      </div>
      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? '로그인 중...' : '로그인'}
      </Button>
    </form>
  );
}
