import { useState, useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { USER_LEVELS } from '@/utils/constants';
import { Sidebar } from '@/components/layout/Sidebar';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { UserManagement } from '@/components/features/users/UserManagement';
import { DeviceManagement } from '@/components/features/devices/DeviceManagement';
import { SubscriptionsManagement } from '@/components/features/subscriptions/SubscriptionsManagement';
import { ConfigurationManagement } from '@/components/features/configuration/ConfigurationManagement';
import { AnalyticsDashboard } from '@/components/features/dashboard/AnalyticsDashboard';

type TabType = 'analytics' | 'users' | 'devices' | 'subscriptions' | 'configuration';

interface LocationState {
  activeTab?: TabType;
}

function isTabType(value: string | null): value is TabType {
  return value === 'analytics' || value === 'users' || value === 'devices' || value === 'subscriptions' || value === 'configuration';
}

export function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const locationState = location.state as LocationState | null;
  const tabFromQuery = searchParams.get('tab');

  const getDefaultTab = (): TabType => {
    if (isTabType(tabFromQuery)) {
      return tabFromQuery;
    }
    if (locationState?.activeTab) {
      return locationState.activeTab;
    }
    return 'analytics';
  };

  const [activeTab, setActiveTab] = useState<TabType>(getDefaultTab());

  // Sync tab from querystring changes
  useEffect(() => {
    if (isTabType(tabFromQuery) && tabFromQuery !== activeTab) {
      setActiveTab(tabFromQuery);
    }
  }, [tabFromQuery, activeTab]);

  // If URL tab is invalid, normalize it to default tab
  useEffect(() => {
    if (tabFromQuery && !isTabType(tabFromQuery)) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('tab', 'analytics');
      setSearchParams(nextParams, { replace: true });
    }
  }, [tabFromQuery, searchParams, setSearchParams]);

  // Support existing navigate(..., { state: { activeTab } }) flows by moving state into query param
  useEffect(() => {
    if (locationState?.activeTab && tabFromQuery !== locationState.activeTab) {
      setActiveTab(locationState.activeTab);
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('tab', locationState.activeTab);
      setSearchParams(nextParams, { replace: true });
    }
  }, [locationState, tabFromQuery, searchParams, setSearchParams]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', tab);
    setSearchParams(nextParams, { replace: true });

    // Invalidate queries to refresh data on each tab click
    if (tab === 'analytics') {
      queryClient.invalidateQueries({ queryKey: ['deviceAnalytics'] });
    } else if (tab === 'users') {
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
        {activeTab === 'analytics' && <AnalyticsDashboard />}
        {activeTab === 'users' && user?.userLevel === USER_LEVELS.L1 && <UserManagement />}
        {activeTab === 'subscriptions' && user?.userLevel === USER_LEVELS.L1 && <SubscriptionsManagement />}
        {activeTab === 'devices' && <DeviceManagement />}
        {activeTab === 'configuration' && user?.userLevel === USER_LEVELS.L1 && <ConfigurationManagement />}
      </div>
    </DashboardLayout>
  );
}
