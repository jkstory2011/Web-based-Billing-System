import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { Button } from '../../components/ui/button';
import { useSettings, useUpdateSettings } from './settings-api';

export function SettingsPage() {
  const { role } = useAuth();
  const canAccess = role === 'ADMIN';
  const { data: settings, isLoading, error } = useSettings({ enabled: canAccess });
  const updateSettings = useUpdateSettings();

  if (!canAccess) {
    return <Navigate to="/" replace />;
  }

  if (isLoading) return <p>불러오는 중...</p>;
  if (error || !settings) return <p className="text-red-600">설정을 불러오지 못했습니다.</p>;

  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-xl font-semibold">설정</h1>
      <div className="flex items-center justify-between rounded-md border border-slate-200 p-4">
        <div>
          <p className="font-medium">연체 자동 알림 발송</p>
          <p className="text-sm text-slate-500">켜면 매일 09:00에 연체 청구서에 자동으로 독촉 메일이 발송됩니다.</p>
        </div>
        <Button
          onClick={() => updateSettings.mutate({ autoReminderEnabled: !settings.autoReminderEnabled })}
          disabled={updateSettings.isPending}
          className={
            settings.autoReminderEnabled
              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
              : 'bg-slate-200 text-slate-900 hover:bg-slate-300'
          }
        >
          {settings.autoReminderEnabled ? '켜짐' : '꺼짐'}
        </Button>
      </div>
    </div>
  );
}
