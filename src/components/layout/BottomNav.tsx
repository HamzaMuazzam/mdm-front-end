import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useAuthStore } from '@/store/authStore';
import { useLogout } from '@/hooks/useAuth';
import { usePermissionStore } from '@/store/permissionStore';
import {
  LayoutDashboard,
  Smartphone,
  FileBarChart,
  MoreHorizontal,
  Users,
  CreditCard,
  Settings,
  ShieldCheck,
  RefreshCw,
  PackageSearch,
  HardDrive,
  Layers,
  LogOut,
} from 'lucide-react';

export type BottomNavTab =
  | 'analytics'
  | 'users'
  | 'devices'
  | 'device-groups'
  | 'subscriptions'
  | 'configuration'
  | 'security-groups'
  | 'app-update'
  | 'app-management'
  | 'file-manager'
  | 'reports';

interface BottomNavProps {
  activeTab: BottomNavTab;
  onTabChange: (tab: BottomNavTab) => void;
}

interface NavItem {
  key: BottomNavTab;
  label: string;
  icon: ReactNode;
  visible: boolean;
}

/**
 * Mobile-only bottom navigation bar (hidden at >= lg).
 * Primary tabs stay one thumb-tap away; everything else lives in a
 * native-style "More" bottom sheet.
 */
export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const user = useAuthStore((state) => state.user);
  const logout = useLogout();
  const hasPermission = usePermissionStore((state) => state.hasPermission);

  const primaryDefs: NavItem[] = [
    {
      key: 'analytics',
      label: 'Analytics',
      icon: <LayoutDashboard className="h-[22px] w-[22px]" />,
      visible: hasPermission('user:analytics'),
    },
    {
      key: 'devices',
      label: 'Devices',
      icon: <Smartphone className="h-[22px] w-[22px]" />,
      visible: hasPermission('devices:read'),
    },
    {
      key: 'reports',
      label: 'Reports',
      icon: <FileBarChart className="h-[22px] w-[22px]" />,
      visible: hasPermission('user:analytics'),
    },
  ];
  const primaryItems = primaryDefs.filter((item) => item.visible);

  const moreDefs: NavItem[] = [
    {
      key: 'device-groups',
      label: 'Device Groups',
      icon: <Layers className="h-5 w-5" />,
      visible: hasPermission('devices:read'),
    },
    {
      key: 'users',
      label: 'Users',
      icon: <Users className="h-5 w-5" />,
      visible: hasPermission('user:read'),
    },
    {
      key: 'subscriptions',
      label: 'Subscriptions',
      icon: <CreditCard className="h-5 w-5" />,
      visible: hasPermission('subscriptions:read'),
    },
    {
      key: 'configuration',
      label: 'Configuration',
      icon: <Settings className="h-5 w-5" />,
      visible: hasPermission('configuration:read'),
    },
    {
      key: 'security-groups',
      label: 'Security Groups',
      icon: <ShieldCheck className="h-5 w-5" />,
      visible: hasPermission('security-group:read'),
    },
    {
      key: 'app-update',
      label: 'App Update',
      icon: <RefreshCw className="h-5 w-5" />,
      visible: hasPermission('app-updates:upload'),
    },
    {
      key: 'app-management',
      label: 'App Management',
      icon: <PackageSearch className="h-5 w-5" />,
      visible:
        hasPermission('app-management:read') ||
        hasPermission('app-management:upload') ||
        hasPermission('app-management:deploy'),
    },
    {
      key: 'file-manager',
      label: 'File Manager',
      icon: <HardDrive className="h-5 w-5" />,
      visible:
        hasPermission('file-manager:read') || hasPermission('file-manager:command'),
    },
  ];
  const moreItems = moreDefs.filter((item) => item.visible);

  const isMoreActive = moreItems.some((item) => item.key === activeTab);

  // Close the sheet with the hardware/browser back-friendly Escape key
  useEffect(() => {
    if (!isMoreOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMoreOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isMoreOpen]);

  const handleSelect = (tab: BottomNavTab) => {
    setIsMoreOpen(false);
    onTabChange(tab);
  };

  return (
    <>
      {/* Bottom tab bar */}
      <nav
        className="lg:hidden no-press fixed bottom-0 inset-x-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur-md pb-safe"
        aria-label="Primary"
      >
        <div className="flex items-stretch">
          {primaryItems.map((item) => {
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => handleSelect(item.key)}
                className={`flex-1 min-h-[56px] flex flex-col items-center justify-center gap-0.5 px-1 select-none transition-colors ${
                  isActive ? 'text-blue-600' : 'text-gray-500'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span
                  className={`flex items-center justify-center rounded-full px-4 py-0.5 transition-colors ${
                    isActive ? 'bg-blue-50' : ''
                  }`}
                >
                  {item.icon}
                </span>
                <span className="text-[10px] font-medium leading-tight">{item.label}</span>
              </button>
            );
          })}
          {moreItems.length > 0 && (
            <button
              onClick={() => setIsMoreOpen(true)}
              className={`flex-1 min-h-[56px] flex flex-col items-center justify-center gap-0.5 px-1 select-none transition-colors ${
                isMoreActive || isMoreOpen ? 'text-blue-600' : 'text-gray-500'
              }`}
            >
              <span
                className={`flex items-center justify-center rounded-full px-4 py-0.5 transition-colors ${
                  isMoreActive || isMoreOpen ? 'bg-blue-50' : ''
                }`}
              >
                <MoreHorizontal className="h-[22px] w-[22px]" />
              </span>
              <span className="text-[10px] font-medium leading-tight">More</span>
            </button>
          )}
        </div>
      </nav>

      {/* "More" bottom sheet */}
      {isMoreOpen &&
        createPortal(
          <div className="lg:hidden fixed inset-0 z-50">
            <div
              className="absolute inset-0 bg-black/40 animate-overlay-in"
              onClick={() => setIsMoreOpen(false)}
            />
            <div className="no-press absolute bottom-0 inset-x-0 rounded-t-2xl bg-white shadow-2xl animate-sheet-up pb-safe max-h-[80vh] flex flex-col">
              {/* Grab handle */}
              <div className="flex justify-center pt-2.5 pb-1">
                <div className="h-1 w-10 rounded-full bg-gray-300" />
              </div>

              {/* Signed-in header */}
              <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <span className="text-sm font-semibold text-blue-700">
                    {user?.email?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">Signed in as</p>
                  <p className="text-sm font-medium text-gray-900 truncate">{user?.email}</p>
                </div>
              </div>

              {/* Remaining destinations */}
              <div className="flex-1 overflow-y-auto px-3 py-2">
                {moreItems.map((item) => {
                  const isActive = activeTab === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => handleSelect(item.key)}
                      className={`w-full min-h-[48px] flex items-center gap-3.5 rounded-xl px-3.5 text-[15px] font-medium mb-1 transition-colors ${
                        isActive
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-700 active:bg-gray-100'
                      }`}
                    >
                      <span className={isActive ? 'text-blue-600' : 'text-gray-400'}>
                        {item.icon}
                      </span>
                      {item.label}
                    </button>
                  );
                })}

                <div className="my-2 border-t border-gray-100" />

                <button
                  onClick={() => {
                    setIsMoreOpen(false);
                    logout();
                  }}
                  className="w-full min-h-[48px] flex items-center gap-3.5 rounded-xl px-3.5 text-[15px] font-medium text-red-600 active:bg-red-50 transition-colors"
                >
                  <LogOut className="h-5 w-5" />
                  Logout
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
