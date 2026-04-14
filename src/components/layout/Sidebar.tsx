import { useState, type ReactNode } from 'react';
import {
  LayoutDashboard,
  Smartphone,
  Users,
  CreditCard,
  SlidersHorizontal,
  ShieldCheck,
  Upload,
  Store,
  FolderSync,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useLogout } from '@/hooks/useAuth';
import { usePermissionStore } from '@/store/permissionStore';
import { nexusTheme, type TabKey } from '@/lib/theme';

interface SidebarProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

interface NavItem {
  key: TabKey;
  label: string;
  icon: ReactNode;
  permission: string | string[];
}

const NAV_ITEMS: NavItem[] = [
  {
    key: 'overview',
    label: 'Overview',
    icon: <LayoutDashboard className="h-[18px] w-[18px]" />,
    permission: 'user:analytics',
  },
  {
    key: 'devices',
    label: 'Device Hub',
    icon: <Smartphone className="h-[18px] w-[18px]" />,
    permission: 'devices:read',
  },
  {
    key: 'team',
    label: 'Team',
    icon: <Users className="h-[18px] w-[18px]" />,
    permission: 'user:read',
  },
  {
    key: 'plans',
    label: 'Plans',
    icon: <CreditCard className="h-[18px] w-[18px]" />,
    permission: 'subscriptions:read',
  },
  {
    key: 'profiles',
    label: 'Device Profiles',
    icon: <SlidersHorizontal className="h-[18px] w-[18px]" />,
    permission: 'configuration:read',
  },
  {
    key: 'access-control',
    label: 'Access Control',
    icon: <ShieldCheck className="h-[18px] w-[18px]" />,
    permission: 'security-group:read',
  },
  {
    key: 'app-deploy',
    label: 'App Deploy',
    icon: <Upload className="h-[18px] w-[18px]" />,
    permission: 'app-updates:upload',
  },
  {
    key: 'app-store',
    label: 'App Store',
    icon: <Store className="h-[18px] w-[18px]" />,
    permission: ['app-management:read', 'app-management:upload', 'app-management:deploy'],
  },
  {
    key: 'file-transfer',
    label: 'File Transfer',
    icon: <FolderSync className="h-[18px] w-[18px]" />,
    permission: ['file-manager:read', 'file-manager:command'],
  },
];

function getInitials(email?: string): string {
  if (!email) return '?';
  const [local] = email.split('@');
  const parts = local.split(/[._-]/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

export function Sidebar({
  activeTab,
  onTabChange,
  isMobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const hasPermission = usePermissionStore((s) => s.hasPermission);

  const checkPerm = (perm: string | string[]) => {
    if (Array.isArray(perm)) return perm.some((p) => hasPermission(p));
    return hasPermission(perm);
  };

  const handleNav = (tab: TabKey) => {
    onTabChange(tab);
    onMobileClose?.();
  };

  const content = (isCollapsed: boolean) => (
    <div className="flex flex-col h-full">
      {/* ── Brand ──────────────────────────────────────────────── */}
      <div className={`flex items-center gap-3 px-5 py-5 ${isCollapsed ? 'px-4 justify-center' : ''}`}>
        <div className="flex-shrink-0 w-8 h-8 rounded-xl nexus-gradient flex items-center justify-center shadow-glow-primary">
          <span className="text-white font-bold text-sm tracking-tight">N</span>
        </div>
        {!isCollapsed && (
          <div className="overflow-hidden">
            <p className="text-white font-bold text-base leading-none tracking-tight">
              {nexusTheme.brand.name}
            </p>
            <p className="text-[10px] text-white/40 font-medium uppercase tracking-[0.12em] mt-0.5">
              MDM Platform
            </p>
          </div>
        )}
      </div>

      {/* ── Divider ─────────────────────────────────────────────── */}
      <div className="mx-4 h-px bg-white/8 mb-3" />

      {/* ── User Profile ────────────────────────────────────────── */}
      <div className={`mx-3 mb-4 ${isCollapsed ? 'flex justify-center' : ''}`}>
        {isCollapsed ? (
          <div
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center"
            title={user?.email}
          >
            <span className="text-white text-xs font-bold">{getInitials(user?.email)}</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/6 hover:bg-white/10 transition-colors cursor-default">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">{getInitials(user?.email)}</span>
            </div>
            <div className="min-w-0">
              <p className="text-white/90 text-xs font-semibold truncate leading-none">
                {user?.email?.split('@')[0]}
              </p>
              <p className="text-white/40 text-[10px] truncate mt-0.5 leading-none">
                {user?.email}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Navigation ──────────────────────────────────────────── */}
      <nav className={`flex-1 overflow-y-auto space-y-0.5 ${isCollapsed ? 'px-2' : 'px-3'}`}>
        {!isCollapsed && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/25 px-3 mb-2">
            Navigation
          </p>
        )}
        {NAV_ITEMS.filter((item) => checkPerm(item.permission)).map((item) => {
          const isActive = activeTab === item.key;
          return (
            <NavButton
              key={item.key}
              icon={item.icon}
              label={item.label}
              isActive={isActive}
              isCollapsed={isCollapsed}
              onClick={() => handleNav(item.key)}
            />
          );
        })}
      </nav>

      {/* ── Divider ─────────────────────────────────────────────── */}
      <div className="mx-4 h-px bg-white/8 my-3" />

      {/* ── Logout ──────────────────────────────────────────────── */}
      <div className={`pb-4 ${isCollapsed ? 'px-2' : 'px-3'}`}>
        <button
          onClick={logout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/50 hover:text-white/80 hover:bg-white/8 transition-all duration-150 group ${
            isCollapsed ? 'justify-center' : ''
          }`}
          title={isCollapsed ? 'Sign Out' : undefined}
        >
          <LogOut className="h-[18px] w-[18px] flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
          {!isCollapsed && <span className="text-sm font-medium">Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Mobile overlay ──────────────────────────────────────── */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* ── Mobile Drawer ───────────────────────────────────────── */}
      <div
        className={`fixed top-0 left-0 h-full z-50 w-72 bg-[#0f172a] flex flex-col transition-transform duration-300 ease-out lg:hidden ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          onClick={onMobileClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/8 hover:bg-white/14 text-white/60 hover:text-white transition-colors z-10"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
        {content(false)}
      </div>

      {/* ── Desktop Sidebar ─────────────────────────────────────── */}
      <div
        className={`hidden lg:flex h-screen bg-[#0f172a] flex-col relative flex-shrink-0 transition-all duration-300 ease-out ${
          collapsed ? 'w-[72px]' : 'w-[260px]'
        }`}
      >
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-[72px] z-10 w-6 h-6 rounded-full bg-[#0f172a] border border-white/15 flex items-center justify-center text-white/50 hover:text-white hover:border-white/30 transition-all duration-150 shadow-md"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronLeft className="h-3 w-3" />
          )}
        </button>

        {content(collapsed)}
      </div>
    </>
  );
}

interface NavButtonProps {
  icon: ReactNode;
  label: string;
  isActive: boolean;
  isCollapsed: boolean;
  onClick: () => void;
}

function NavButton({ icon, label, isActive, isCollapsed, onClick }: NavButtonProps) {
  return (
    <button
      onClick={onClick}
      title={isCollapsed ? label : undefined}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group relative ${
        isCollapsed ? 'justify-center' : ''
      } ${
        isActive
          ? 'bg-white/12 text-white shadow-sm'
          : 'text-white/55 hover:bg-white/7 hover:text-white/85'
      }`}
    >
      {/* Active indicator */}
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary-400 rounded-r-full" />
      )}

      {/* Icon wrapper */}
      <span
        className={`flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-150 ${
          isActive
            ? 'bg-primary-500/20 text-primary-300'
            : 'text-white/55 group-hover:text-white/80'
        }`}
      >
        {icon}
      </span>

      {/* Label */}
      {!isCollapsed && (
        <span className="truncate leading-none">{label}</span>
      )}
    </button>
  );
}
