import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PaginationControls } from './pagination-controls';

describe('PaginationControls', () => {
  it('disables 이전 on the first page and 다음 on the last page', () => {
    const { rerender } = render(<PaginationControls page={1} totalPages={3} onPrev={vi.fn()} onNext={vi.fn()} />);

    expect(screen.getByRole('button', { name: '이전' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '다음' })).not.toBeDisabled();

    rerender(<PaginationControls page={3} totalPages={3} onPrev={vi.fn()} onNext={vi.fn()} />);

    expect(screen.getByRole('button', { name: '이전' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
  });

  it('calls onPrev/onNext when clicked', () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    render(<PaginationControls page={2} totalPages={3} onPrev={onPrev} onNext={onNext} />);

    fireEvent.click(screen.getByRole('button', { name: '이전' }));
    fireEvent.click(screen.getByRole('button', { name: '다음' }));

    expect(onPrev).toHaveBeenCalledOnce();
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('shows the current page and total pages', () => {
    render(<PaginationControls page={2} totalPages={5} onPrev={vi.fn()} onNext={vi.fn()} />);

    expect(screen.getByText('2 / 5 페이지')).toBeInTheDocument();
  });
});
