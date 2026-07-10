import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CustomerForm } from './customer-form';

describe('CustomerForm', () => {
  it('validates required fields before calling onSubmit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CustomerForm onSubmit={onSubmit} submitLabel="등록" />);

    fireEvent.click(screen.getByRole('button', { name: '등록' }));

    await waitFor(() => expect(screen.getByText('이름을 입력해주세요.')).toBeInTheDocument());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits the entered values', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CustomerForm onSubmit={onSubmit} submitLabel="등록" />);

    fireEvent.change(screen.getByLabelText('이름'), { target: { value: '홍길동' } });
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'hong@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: '등록' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ name: '홍길동', email: 'hong@example.com', type: 'INDIVIDUAL' }),
      ),
    );
  });
});
