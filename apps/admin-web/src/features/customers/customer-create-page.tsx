import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../../lib/api-client';
import { CustomerForm } from './customer-form';
import { useCreateCustomer } from './customers-api';

export function CustomerCreatePage() {
  const navigate = useNavigate();
  const createCustomer = useCreateCustomer();
  const [serverError, setServerError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">새 고객 등록</h1>
      <CustomerForm
        submitLabel="등록"
        serverError={serverError}
        onSubmit={async (values) => {
          setServerError(null);
          try {
            const customer = await createCustomer.mutateAsync(values);
            navigate(`/customers/${customer.id}`);
          } catch (error) {
            setServerError(error instanceof ApiError ? error.message : '등록에 실패했습니다.');
          }
        }}
      />
    </div>
  );
}
