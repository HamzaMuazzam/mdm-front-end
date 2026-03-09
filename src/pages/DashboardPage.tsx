import { useState, useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Sidebar } from '@/components/layout/Sidebar';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { UserManagement } from '@/components/features/users/UserManagement';
import { DeviceManagement } from '@/components/features/devices/DeviceManagement';
import { SubscriptionsManagement } from '@/components/features/subscriptions/SubscriptionsManagement';
import { ConfigurationManagement } from '@/components/features/configuration/ConfigurationManagement';
import { AnalyticsDashboard } from '@/components/features/dashboard/AnalyticsDashboard';
import { SecurityGroupManagement } from '@/components/features/security-groups/SecurityGroupManagement';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { usePermissionsQuery } from '@/hooks/usePermissions';

type TabType = 'analytics' | 'users' | 'devices' | 'subscriptions' | 'configuration' | 'security-groups';

interface LocationState {
  activeTab?: TabType;
}

function isTabType(value: string | null): value is TabType {
  return (
    value === 'analytics' ||
    value === 'users' ||
    value === 'devices' ||
    value === 'subscriptions' ||
    value === 'configuration' ||
    value === 'security-groups'
  );
}

export function DashboardPage() {
  const queryClient = useQueryClient();
  // Fetch user permissions on every page load/refresh
  usePermissionsQuery();
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
    } else if (tab === 'security-groups') {
      queryClient.invalidateQueries({ queryKey: ['security-groups'] });
    }
  };

  return (
    <DashboardLayout sidebar={<Sidebar activeTab={activeTab} onTabChange={handleTabChange} />}>
      <div className={activeTab === 'devices' || activeTab === 'users' || activeTab === 'security-groups' ? 'h-full p-8' : 'p-8'}>
        {activeTab === 'analytics' && (
          <ErrorBoundary moduleName="Analytics">
            <AnalyticsDashboard />
          </ErrorBoundary>
        )}
        {activeTab === 'users' && (
          <ErrorBoundary moduleName="User Management">
            <UserManagement />
          </ErrorBoundary>
        )}
        {activeTab === 'subscriptions' && (
          <ErrorBoundary moduleName="Subscriptions">
            <SubscriptionsManagement />
          </ErrorBoundary>
        )}
        {activeTab === 'devices' && (
          <ErrorBoundary moduleName="Device Management">
            <DeviceManagement />
          </ErrorBoundary>
        )}
        {activeTab === 'configuration' && (
          <ErrorBoundary moduleName="Configuration">
            <ConfigurationManagement />
          </ErrorBoundary>
        )}
        {activeTab === 'security-groups' && (
          <ErrorBoundary moduleName="Security Groups">
            <SecurityGroupManagement />
          </ErrorBoundary>
        )}
      </div>
    </DashboardLayout>
  );
}
