import { Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import { Button } from '../components/ui/button';

export function AppLayout() {
  const { logout, role } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <nav className="flex items-center gap-4 text-sm font-medium text-slate-700" />
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span>{role}</span>
          <Button onClick={logout} className="bg-slate-200 text-slate-900 hover:bg-slate-300">
            로그아웃
          </Button>
        </div>
      </header>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}
