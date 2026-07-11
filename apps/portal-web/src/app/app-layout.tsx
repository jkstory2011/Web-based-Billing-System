import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import { Button } from '../components/ui/button';

export function AppLayout() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <Link to="/" className="text-sm font-medium text-slate-700">
          청구 시스템 고객 포털
        </Link>
        <Button onClick={logout} className="bg-slate-200 text-slate-900 hover:bg-slate-300">
          로그아웃
        </Button>
      </header>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}
