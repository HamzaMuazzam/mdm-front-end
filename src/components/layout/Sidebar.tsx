import { useState, type ReactNode } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useLogout } from '@/hooks/useAuth';
import { usePermissionStore } from '@/store/permissionStore';
import {
  LayoutDashboard,
  Users,
  Smartphone,
  CreditCard,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  PackageSearch,
  HardDrive,
  FileBarChart,
  X,
} from 'lucide-react';

interface SidebarProps {
  activeTab: 'analytics' | 'users' | 'devices' | 'subscriptions' | 'configuration' | 'security-groups' | 'app-update' | 'app-management' | 'file-manager' | 'reports';
  onTabChange: (tab: 'analytics' | 'users' | 'devices' | 'subscriptions' | 'configuration' | 'security-groups' | 'app-update' | 'app-management' | 'file-manager' | 'reports') => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ activeTab, onTabChange, isMobileOpen = false, onMobileClose }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const user = useAuthStore((state) => state.user);
  const logout = useLogout();
  const hasPermission = usePermissionStore((state) => state.hasPermission);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const handleNavClick = (tab: SidebarProps['activeTab']) => {
    onTabChange(tab);
    if (onMobileClose) onMobileClose();
  };

  // Desktop sidebar content (shared)
  const sidebarContent = (collapsed: boolean) => (
    <>
      {/* Logo Section */}
      <div className={`h-16 flex items-center border-b border-gray-200 ${collapsed ? 'justify-center px-2' : 'px-5'}`}>
        <div className="flex items-center gap-3">
          <img
            src="/tw_logo.png"
            alt="MDM Portal"
            className="h-8 w-8 shrink-0"
          />
          <span
            className={`text-base font-semibold text-gray-900 whitespace-nowrap overflow-hidden transition-all duration-300 ${
              collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
            }`}
          >
            MDM Portal
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className={`flex-1 space-y-0.5 py-4 overflow-y-auto ${collapsed ? 'px-2' : 'px-3'}`}>
        {hasPermission('user:analytics') && (
          <NavButton
            icon={<LayoutDashboard className="h-4 w-4" />}
            label="Analytics"
            isActive={activeTab === 'analytics'}
            isCollapsed={collapsed}
            onClick={() => handleNavClick('analytics')}
          />
        )}
        {hasPermission('user:analytics') && (
          <NavButton
            icon={<FileBarChart className="h-4 w-4" />}
            label="Reports"
            isActive={activeTab === 'reports'}
            isCollapsed={collapsed}
            onClick={() => handleNavClick('reports')}
          />
        )}
        {hasPermission('user:read') && (
          <NavButton
            icon={<Users className="h-4 w-4" />}
            label="Users"
            isActive={activeTab === 'users'}
            isCollapsed={collapsed}
            onClick={() => handleNavClick('users')}
          />
        )}
        {hasPermission('subscriptions:read') && (
          <NavButton
            icon={<CreditCard className="h-4 w-4" />}
            label="Subscriptions"
            isActive={activeTab === 'subscriptions'}
            isCollapsed={collapsed}
            onClick={() => handleNavClick('subscriptions')}
          />
        )}
        {hasPermission('devices:read') && (
          <NavButton
            icon={<Smartphone className="h-4 w-4" />}
            label="Devices"
            isActive={activeTab === 'devices'}
            isCollapsed={collapsed}
            onClick={() => handleNavClick('devices')}
          />
        )}
        {hasPermission('configuration:read') && (
          <NavButton
            icon={<Settings className="h-4 w-4" />}
            label="Configuration"
            isActive={activeTab === 'configuration'}
            isCollapsed={collapsed}
            onClick={() => handleNavClick('configuration')}
          />
        )}
        {hasPermission('security-group:read') && (
          <NavButton
            icon={<ShieldCheck className="h-4 w-4" />}
            label="Security Groups"
            isActive={activeTab === 'security-groups'}
            isCollapsed={collapsed}
            onClick={() => handleNavClick('security-groups')}
          />
        )}
        {hasPermission('app-updates:upload') && (
          <NavButton
            icon={<RefreshCw className="h-4 w-4" />}
            label="App Update"
            isActive={activeTab === 'app-update'}
            isCollapsed={collapsed}
            onClick={() => handleNavClick('app-update')}
          />
        )}
        {(hasPermission('app-management:read') || hasPermission('app-management:upload') || hasPermission('app-management:deploy')) && (
          <NavButton
            icon={<PackageSearch className="h-4 w-4" />}
            label="App Management"
            isActive={activeTab === 'app-management'}
            isCollapsed={collapsed}
            onClick={() => handleNavClick('app-management')}
          />
        )}
        {(hasPermission('file-manager:read') || hasPermission('file-manager:command')) && (
          <NavButton
            icon={<HardDrive className="h-4 w-4" />}
            label="File Manager"
            isActive={activeTab === 'file-manager'}
            isCollapsed={collapsed}
            onClick={() => handleNavClick('file-manager')}
          />
        )}
      </nav>

      {/* User Info + Logout */}
      <div className={`border-t border-gray-200 p-3 ${collapsed ? 'px-2' : ''}`}>
        <div className={`flex items-center gap-3 mb-2 ${collapsed ? 'justify-center' : 'px-2'}`}>
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-blue-700">
              {user?.email?.charAt(0).toUpperCase()}
            </span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Signed in as</p>
              <p className="text-sm font-medium text-gray-900 truncate">{user?.email}</p>
            </div>
          )}
        </div>
        <button
          onClick={logout}
          title={collapsed ? 'Logout' : undefined}
          className={`w-full flex items-center rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors ${
            collapsed ? 'justify-center px-2' : ''
          }`}
        >
          <LogOut className={`h-4 w-4 ${collapsed ? '' : 'mr-3'}`} />
          <span
            className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${
              collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
            }`}
          >
            Logout
          </span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Mobile Drawer */}
      <div
        className={`fixed top-0 left-0 h-full z-50 w-72 bg-sidebar border-r border-gray-200 text-gray-900 flex flex-col transition-transform duration-300 ease-in-out lg:hidden ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Close button */}
        <button
          onClick={onMobileClose}
          className="absolute top-4 right-4 p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>

        {sidebarContent(false)}
      </div>

      {/* Desktop Sidebar */}
      <div
        className={`hidden lg:flex h-screen bg-sidebar border-r border-gray-200 text-gray-900 flex-col relative transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        {/* Collapse Toggle Button */}
        <button
          onClick={toggleSidebar}
          className="absolute -right-3 top-6 bg-white border border-gray-200 rounded-full p-1 text-gray-500 shadow-sm hover:bg-gray-50 hover:text-gray-900 transition-colors z-10"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>

        {sidebarContent(isCollapsed)}
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
      className={`w-full flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        isActive
          ? 'bg-blue-50 text-blue-700'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      } ${isCollapsed ? 'justify-center px-2' : 'justify-start'}`}
      onClick={onClick}
      title={isCollapsed ? label : undefined}
    >
      <span className={`shrink-0 ${isCollapsed ? '' : 'mr-3'}`}>{icon}</span>
      <span
        className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${
          isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
        }`}
      >
        {label}
      </span>
    </button>
  );
}
