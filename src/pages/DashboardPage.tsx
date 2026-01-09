import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { USER_LEVELS } from '@/utils/constants';
import { Sidebar } from '@/components/layout/Sidebar';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { UserManagement } from '@/components/features/users/UserManagement';
import { DeviceManagement } from '@/components/features/devices/DeviceManagement';

export function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const [activeTab, setActiveTab] = useState<'users' | 'devices'>(
    user?.userLevel === USER_LEVELS.L1 ? 'users' : 'devices'
  );

  return (
    <DashboardLayout sidebar={<Sidebar activeTab={activeTab} onTabChange={setActiveTab} />}>
      <div className="p-8">
        {activeTab === 'users' && user?.userLevel === USER_LEVELS.L1 && <UserManagement />}
        {activeTab === 'devices' && <DeviceManagement />}
      </div>
    </DashboardLayout>
  );
}
