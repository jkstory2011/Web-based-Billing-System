import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('renders the admin app title', () => {
    render(<App />);
    expect(screen.getByText('청구 시스템 관리자')).toBeInTheDocument();
  });
});
