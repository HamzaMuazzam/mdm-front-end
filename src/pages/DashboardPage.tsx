import { useState, useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Sidebar } from '@/components/layout/Sidebar';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { BottomNav } from '@/components/layout/BottomNav';
import { UserManagement } from '@/components/features/users/UserManagement';
import { DeviceManagement } from '@/components/features/devices/DeviceManagement';
import { SubscriptionsManagement } from '@/components/features/subscriptions/SubscriptionsManagement';
import { ConfigurationManagement } from '@/components/features/configuration/ConfigurationManagement';
import { AnalyticsDashboard } from '@/components/features/dashboard/AnalyticsDashboard';
import { SecurityGroupManagement } from '@/components/features/security-groups/SecurityGroupManagement';
import { AppUpdateManagement } from '@/components/features/app-update/AppUpdateManagement';
import { AppManagement } from '@/components/features/app-management/AppManagement';
import { FileManagerPage } from '@/components/features/file-manager/FileManagerPage';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { usePermissionsQuery } from '@/hooks/usePermissions';
import type { TabKey } from '@/lib/theme';

// ─── Terminology Map (old → new display names) ──────────────────────────────
// overview       ← analytics
// team           ← users
// devices        ← devices
// plans          ← subscriptions
// profiles       ← configuration
// access-control ← security-groups
// app-deploy     ← app-update
// app-store      ← app-management
// file-transfer  ← file-manager

const ALL_TABS: TabKey[] = [
  'overview',
  'team',
  'devices',
  'plans',
  'profiles',
  'access-control',
  'app-deploy',
  'app-store',
  'file-transfer',
];

const TAB_LABELS: Record<TabKey, string> = {
  overview: 'Overview',
  team: 'Team',
  devices: 'Device Hub',
  plans: 'Plans',
  profiles: 'Device Profiles',
  'access-control': 'Access Control',
  'app-deploy': 'App Deploy',
  'app-store': 'App Store',
  'file-transfer': 'File Transfer',
};

// Tabs that use full-height layout (no extra bottom padding for content)
const FULL_HEIGHT_TABS: TabKey[] = ['devices', 'team', 'access-control', 'app-store', 'file-transfer'];

function isValidTab(value: string | null): value is TabKey {
  return ALL_TABS.includes(value as TabKey);
}

interface LocationState {
  activeTab?: TabKey;
}

export function DashboardPage() {
  const queryClient = useQueryClient();
  usePermissionsQuery();

  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const locationState = location.state as LocationState | null;
  const tabFromQuery = searchParams.get('tab');

  const getDefaultTab = (): TabKey => {
    if (isValidTab(tabFromQuery)) return tabFromQuery;
    if (locationState?.activeTab) return locationState.activeTab;
    return 'overview';
  };

  const [activeTab, setActiveTab] = useState<TabKey>(getDefaultTab());

  // Sync tab from URL query param changes
  useEffect(() => {
    if (isValidTab(tabFromQuery) && tabFromQuery !== activeTab) {
      setActiveTab(tabFromQuery);
    }
  }, [tabFromQuery, activeTab]);

  // Normalize invalid query param
  useEffect(() => {
    if (tabFromQuery && !isValidTab(tabFromQuery)) {
      const next = new URLSearchParams(searchParams);
      next.set('tab', 'overview');
      setSearchParams(next, { replace: true });
    }
  }, [tabFromQuery, searchParams, setSearchParams]);

  // Support navigate(..., { state: { activeTab } }) flows
  useEffect(() => {
    if (locationState?.activeTab && tabFromQuery !== locationState.activeTab) {
      setActiveTab(locationState.activeTab);
      const next = new URLSearchParams(searchParams);
      next.set('tab', locationState.activeTab);
      setSearchParams(next, { replace: true });
    }
  }, [locationState, tabFromQuery, searchParams, setSearchParams]);

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, { replace: true });

    // Invalidate relevant query caches
    const invalidations: Record<TabKey, string[]> = {
      overview: ['deviceAnalytics'],
      team: ['users'],
      devices: ['devices'],
      plans: ['userPlans'],
      profiles: ['parentConfiguration'],
      'access-control': ['security-groups'],
      'app-deploy': [],
      'app-store': ['app-management'],
      'file-transfer': ['fileManagerCommands', 'fileEvents'],
    };

    invalidations[tab]?.forEach((key) =>
      queryClient.invalidateQueries({ queryKey: [key] })
    );
  };

  const isFullHeight = FULL_HEIGHT_TABS.includes(activeTab);
  const contentClass = isFullHeight
    ? 'h-full p-4 sm:p-5 lg:p-6'
    : 'p-4 sm:p-5 lg:p-6 pb-10';

  return (
    <>
      <DashboardLayout
        sidebar={(mobileProps) => (
          <Sidebar activeTab={activeTab} onTabChange={handleTabChange} {...mobileProps} />
        )}
        pageTitle={TAB_LABELS[activeTab]}
      >
        <div className={contentClass}>
          {activeTab === 'overview' && (
            <ErrorBoundary moduleName="Overview">
              <AnalyticsDashboard />
            </ErrorBoundary>
          )}
          {activeTab === 'team' && (
            <ErrorBoundary moduleName="Team">
              <UserManagement />
            </ErrorBoundary>
          )}
          {activeTab === 'plans' && (
            <ErrorBoundary moduleName="Plans">
              <SubscriptionsManagement />
            </ErrorBoundary>
          )}
          {activeTab === 'devices' && (
            <ErrorBoundary moduleName="Device Hub">
              <DeviceManagement />
            </ErrorBoundary>
          )}
          {activeTab === 'profiles' && (
            <ErrorBoundary moduleName="Device Profiles">
              <ConfigurationManagement />
            </ErrorBoundary>
          )}
          {activeTab === 'access-control' && (
            <ErrorBoundary moduleName="Access Control">
              <SecurityGroupManagement />
            </ErrorBoundary>
          )}
          {activeTab === 'app-deploy' && (
            <ErrorBoundary moduleName="App Deploy">
              <AppUpdateManagement />
            </ErrorBoundary>
          )}
          {activeTab === 'app-store' && (
            <ErrorBoundary moduleName="App Store">
              <AppManagement />
            </ErrorBoundary>
          )}
          {activeTab === 'file-transfer' && (
            <ErrorBoundary moduleName="File Transfer">
              <FileManagerPage />
            </ErrorBoundary>
          )}
        </div>
      </DashboardLayout>

      {/* Mobile bottom navigation */}
      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
    </>
  );
}
