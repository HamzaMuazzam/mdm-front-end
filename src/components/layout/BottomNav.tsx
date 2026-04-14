import {
  LayoutDashboard,
  Smartphone,
  Users,
  ShieldCheck,
  MoreHorizontal,
  CreditCard,
  SlidersHorizontal,
  Upload,
  Store,
  FolderSync,
  X,
} from 'lucide-react';
import { usePermissionStore } from '@/store/permissionStore';
import type { TabKey } from '@/lib/theme';
import { BOTTOM_NAV_TABS } from '@/lib/theme';
import { useState } from 'react';

interface BottomNavProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  overview: LayoutDashboard,
  devices: Smartphone,
  team: Users,
  plans: CreditCard,
  profiles: SlidersHorizontal,
  'access-control': ShieldCheck,
  'app-deploy': Upload,
  'app-store': Store,
  'file-transfer': FolderSync,
};

const labelMap: Record<TabKey, string> = {
  overview: 'Overview',
  devices: 'Devices',
  team: 'Team',
  plans: 'Plans',
  profiles: 'Profiles',
  'access-control': 'Security',
  'app-deploy': 'Deploy',
  'app-store': 'Apps',
  'file-transfer': 'Files',
};

const permissionMap: Record<TabKey, string | string[]> = {
  overview: 'user:analytics',
  devices: 'devices:read',
  team: 'user:read',
  plans: 'subscriptions:read',
  profiles: 'configuration:read',
  'access-control': 'security-group:read',
  'app-deploy': 'app-updates:upload',
  'app-store': ['app-management:read', 'app-management:upload', 'app-management:deploy'],
  'file-transfer': ['file-manager:read', 'file-manager:command'],
};

const ALL_TABS: TabKey[] = [
  'overview',
  'devices',
  'team',
  'plans',
  'profiles',
  'access-control',
  'app-deploy',
  'app-store',
  'file-transfer',
];

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const hasPermission = usePermissionStore((s) => s.hasPermission);
  const [moreOpen, setMoreOpen] = useState(false);

  const checkPerm = (perm: string | string[]) => {
    if (Array.isArray(perm)) return perm.some((p) => hasPermission(p));
    return hasPermission(perm);
  };

  const visibleTabs = BOTTOM_NAV_TABS.filter((k) => checkPerm(permissionMap[k]));
  const moreTabs = ALL_TABS.filter(
    (k) => !BOTTOM_NAV_TABS.includes(k) && checkPerm(permissionMap[k])
  );

  const handleTabClick = (tab: TabKey) => {
    onTabChange(tab);
    setMoreOpen(false);
  };

  return (
    <>
      {/* More drawer overlay */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* More drawer */}
      {moreOpen && (
        <div className="fixed bottom-16 left-0 right-0 z-50 mx-3 mb-1 animate-fade-in">
          <div className="rounded-2xl bg-white shadow-float border border-border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-semibold text-foreground">More</span>
              <button
                onClick={() => setMoreOpen(false)}
                className="p-1 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1 p-3">
              {moreTabs.map((tab) => {
                const Icon = iconMap[tab];
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => handleTabClick(tab)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all duration-150 ${
                      isActive
                        ? 'bg-primary-100 text-primary-600'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {Icon && <Icon className="h-5 w-5" />}
                    <span className="text-[11px] font-medium leading-none">{labelMap[tab]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Bottom navigation bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 h-16 bg-white/95 backdrop-blur-md border-t border-border shadow-elevated pb-safe lg:hidden">
        <div className="flex items-center justify-around h-full px-2">
          {visibleTabs.map((tab) => {
            const Icon = iconMap[tab];
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => handleTabClick(tab)}
                className="relative flex flex-col items-center justify-center gap-1 min-w-[56px] h-full px-2 group"
              >
                {isActive && (
                  <span className="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary-500 rounded-full" />
                )}
                <span
                  className={`flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-150 ${
                    isActive
                      ? 'bg-primary-50 text-primary-600'
                      : 'text-muted-foreground group-active:bg-muted'
                  }`}
                >
                  {Icon && <Icon className="h-5 w-5" />}
                </span>
                <span
                  className={`text-[10px] font-medium leading-none transition-colors duration-150 ${
                    isActive ? 'text-primary-600' : 'text-muted-foreground'
                  }`}
                >
                  {labelMap[tab]}
                </span>
              </button>
            );
          })}

          {/* More button (always shown if there are extra tabs) */}
          {moreTabs.length > 0 && (
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className="relative flex flex-col items-center justify-center gap-1 min-w-[56px] h-full px-2 group"
            >
              {moreOpen && (
                <span className="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary-500 rounded-full" />
              )}
              <span
                className={`flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-150 ${
                  moreOpen
                    ? 'bg-primary-50 text-primary-600'
                    : 'text-muted-foreground group-active:bg-muted'
                }`}
              >
                <MoreHorizontal className="h-5 w-5" />
              </span>
              <span
                className={`text-[10px] font-medium leading-none transition-colors duration-150 ${
                  moreOpen ? 'text-primary-600' : 'text-muted-foreground'
                }`}
              >
                More
              </span>
            </button>
          )}
        </div>
      </nav>
    </>
  );
}
