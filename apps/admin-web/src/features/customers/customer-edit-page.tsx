import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../lib/api-client';
import { CustomerForm } from './customer-form';
import { useCustomer, useUpdateCustomer } from './customers-api';

export function CustomerEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: customer, isLoading } = useCustomer(id!);
  const updateCustomer = useUpdateCustomer(id!);
  const [serverError, setServerError] = useState<string | null>(null);

  if (isLoading || !customer) return <p>불러오는 중...</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">고객 정보 수정</h1>
      <CustomerForm
        defaultValues={customer}
        submitLabel="저장"
        serverError={serverError}
        onSubmit={async (values) => {
          setServerError(null);
          try {
            await updateCustomer.mutateAsync(values);
            navigate(`/customers/${id}`);
          } catch (error) {
            setServerError(error instanceof ApiError ? error.message : '수정에 실패했습니다.');
          }
        }}
      />
    </div>
  );
}
