import { useState, useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Sidebar } from '@/components/layout/Sidebar';
import { BottomNav } from '@/components/layout/BottomNav';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { UserManagement } from '@/components/features/users/UserManagement';
import { DeviceManagement } from '@/components/features/devices/DeviceManagement';
import { DeviceGroupManagement } from '@/components/features/device-groups/DeviceGroupManagement';
import { SubscriptionsManagement } from '@/components/features/subscriptions/SubscriptionsManagement';
import { ConfigurationManagement } from '@/components/features/configuration/ConfigurationManagement';
import { AnalyticsDashboard } from '@/components/features/dashboard/AnalyticsDashboard';
import { SecurityGroupManagement } from '@/components/features/security-groups/SecurityGroupManagement';
import { AppUpdateManagement } from '@/components/features/app-update/AppUpdateManagement';
import { AppManagement } from '@/components/features/app-management/AppManagement';
import { FileManagerPage } from '@/components/features/file-manager/FileManagerPage';
import { ReportsDashboard } from '@/components/features/reports/ReportsDashboard';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { usePermissionsQuery } from '@/hooks/usePermissions';

type TabType = 'analytics' | 'users' | 'devices' | 'device-groups' | 'subscriptions' | 'configuration' | 'security-groups' | 'app-update' | 'app-management' | 'file-manager' | 'reports';

const TAB_TITLES: Record<TabType, string> = {
  analytics: 'Analytics',
  reports: 'Reports',
  users: 'Users',
  subscriptions: 'Subscriptions',
  devices: 'Devices',
  'device-groups': 'Device Groups',
  configuration: 'Configuration',
  'security-groups': 'Security Groups',
  'app-update': 'App Update',
  'app-management': 'App Management',
  'file-manager': 'File Manager',
};

interface LocationState {
  activeTab?: TabType;
}

function isTabType(value: string | null): value is TabType {
  return (
    value === 'analytics' ||
    value === 'users' ||
    value === 'devices' ||
    value === 'device-groups' ||
    value === 'subscriptions' ||
    value === 'configuration' ||
    value === 'security-groups' ||
    value === 'app-update' ||
    value === 'app-management' ||
    value === 'file-manager' ||
    value === 'reports'
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
    } else if (tab === 'device-groups') {
      queryClient.invalidateQueries({ queryKey: ['deviceGroups'] });
      queryClient.invalidateQueries({ queryKey: ['bulkOperations'] });
    } else if (tab === 'subscriptions') {
      queryClient.invalidateQueries({ queryKey: ['userPlans'] });
    } else if (tab === 'configuration') {
      queryClient.invalidateQueries({ queryKey: ['parentConfiguration'] });
    } else if (tab === 'security-groups') {
      queryClient.invalidateQueries({ queryKey: ['security-groups'] });
    } else if (tab === 'app-management') {
      queryClient.invalidateQueries({ queryKey: ['app-management'] });
    } else if (tab === 'file-manager') {
      queryClient.invalidateQueries({ queryKey: ['fileManagerCommands'] });
      queryClient.invalidateQueries({ queryKey: ['fileEvents'] });
    } else if (tab === 'reports') {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    }
  };

  return (
    <DashboardLayout
      title={TAB_TITLES[activeTab]}
      sidebar={(mobileProps) => (
        <Sidebar activeTab={activeTab} onTabChange={handleTabChange} {...mobileProps} />
      )}
      bottomNav={<BottomNav activeTab={activeTab} onTabChange={handleTabChange} />}
    >
      <div className={activeTab === 'devices' || activeTab === 'device-groups' || activeTab === 'users' || activeTab === 'security-groups' || activeTab === 'app-management' || activeTab === 'file-manager' ? 'h-full p-4 sm:p-6 lg:p-8' : 'p-4 sm:p-6 lg:p-8 pb-10'}>
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
        {activeTab === 'device-groups' && (
          <ErrorBoundary moduleName="Device Groups">
            <DeviceGroupManagement />
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
        {activeTab === 'app-update' && (
          <ErrorBoundary moduleName="Application Update">
            <AppUpdateManagement />
          </ErrorBoundary>
        )}
        {activeTab === 'app-management' && (
          <ErrorBoundary moduleName="App Management">
            <AppManagement />
          </ErrorBoundary>
        )}
        {activeTab === 'file-manager' && (
          <ErrorBoundary moduleName="File Manager">
            <FileManagerPage />
          </ErrorBoundary>
        )}
        {activeTab === 'reports' && (
          <ErrorBoundary moduleName="Reports">
            <ReportsDashboard />
          </ErrorBoundary>
        )}
      </div>
    </DashboardLayout>
  );
}
