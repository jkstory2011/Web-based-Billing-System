import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('redirects unauthenticated users to the login page', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: '관리자 로그인' })).toBeInTheDocument();
  });
});
