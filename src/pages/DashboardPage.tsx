import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { USER_LEVELS } from '@/utils/constants';
import { Sidebar } from '@/components/layout/Sidebar';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { UserManagement } from '@/components/features/users/UserManagement';
import { DeviceManagement } from '@/components/features/devices/DeviceManagement';
import { SubscriptionsManagement } from '@/components/features/subscriptions/SubscriptionsManagement';
import { ConfigurationManagement } from '@/components/features/configuration/ConfigurationManagement';

export function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'users' | 'devices' | 'subscriptions' | 'configuration'>(
    user?.userLevel === USER_LEVELS.L1 ? 'users' : 'devices'
  );

  const handleTabChange = (tab: 'users' | 'devices' | 'subscriptions' | 'configuration') => {
    setActiveTab(tab);

    // Invalidate queries to refresh data on each tab click
    if (tab === 'users') {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } else if (tab === 'devices') {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    } else if (tab === 'subscriptions') {
      queryClient.invalidateQueries({ queryKey: ['userPlans'] });
    } else if (tab === 'configuration') {
      queryClient.invalidateQueries({ queryKey: ['parentConfiguration'] });
    }
  };

  return (
    <DashboardLayout sidebar={<Sidebar activeTab={activeTab} onTabChange={handleTabChange} />}>
      <div className="p-8">
        {activeTab === 'users' && user?.userLevel === USER_LEVELS.L1 && <UserManagement />}
        {activeTab === 'subscriptions' && user?.userLevel === USER_LEVELS.L1 && <SubscriptionsManagement />}
        {activeTab === 'devices' && <DeviceManagement />}
        {activeTab === 'configuration' && user?.userLevel === USER_LEVELS.L1 && <ConfigurationManagement />}
      </div>
    </DashboardLayout>
  );
}
