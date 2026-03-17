import { useState, type ReactNode } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useLogout } from '@/hooks/useAuth';
import { usePermissionStore } from '@/store/permissionStore';
import { Button } from '@/components/ui/button';
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
  X,
} from 'lucide-react';

interface SidebarProps {
  activeTab: 'analytics' | 'users' | 'devices' | 'subscriptions' | 'configuration' | 'security-groups' | 'app-update' | 'app-management' | 'file-manager';
  onTabChange: (tab: 'analytics' | 'users' | 'devices' | 'subscriptions' | 'configuration' | 'security-groups' | 'app-update' | 'app-management' | 'file-manager') => void;
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
      <div className={`p-6 ${collapsed ? 'px-4' : ''}`}>
        <div className={`flex flex-col items-center justify-center space-y-2 ${collapsed ? 'space-y-0' : ''}`}>
          <img
            src="/tw_logo.png"
            alt="MDM Portal"
            className={`transition-all duration-300 ${collapsed ? 'h-8 w-8' : 'h-10 w-auto'}`}
          />
          <h1
            className={`text-2xl font-bold whitespace-nowrap overflow-hidden transition-all duration-300 ${
              collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
            }`}
          >
            MDM Portal
          </h1>
        </div>
      </div>

      {/* User Info Section */}
      <div className={`mx-4 mb-6 p-3 bg-white/10 rounded-lg overflow-hidden transition-all duration-300 ${
        collapsed ? 'mx-2 p-2' : ''
      }`}>
        {collapsed ? (
          <div className="flex justify-center">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-xs font-bold">
                {user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-300">Signed in as</p>
            <p className="font-medium truncate">{user?.email}</p>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className={`flex-1 space-y-2 ${collapsed ? 'px-2' : 'px-4'}`}>
        {hasPermission('user:analytics') && (
          <NavButton
            icon={<LayoutDashboard className="h-5 w-5" />}
            label="Analytics"
            isActive={activeTab === 'analytics'}
            isCollapsed={collapsed}
            onClick={() => handleNavClick('analytics')}
          />
        )}
        {hasPermission('user:read') && (
          <NavButton
            icon={<Users className="h-5 w-5" />}
            label="Users"
            isActive={activeTab === 'users'}
            isCollapsed={collapsed}
            onClick={() => handleNavClick('users')}
          />
        )}
        {hasPermission('subscriptions:read') && (
          <NavButton
            icon={<CreditCard className="h-5 w-5" />}
            label="Subscriptions"
            isActive={activeTab === 'subscriptions'}
            isCollapsed={collapsed}
            onClick={() => handleNavClick('subscriptions')}
          />
        )}
        {hasPermission('devices:read') && (
          <NavButton
            icon={<Smartphone className="h-5 w-5" />}
            label="Devices"
            isActive={activeTab === 'devices'}
            isCollapsed={collapsed}
            onClick={() => handleNavClick('devices')}
          />
        )}
        {hasPermission('configuration:read') && (
          <NavButton
            icon={<Settings className="h-5 w-5" />}
            label="Configuration"
            isActive={activeTab === 'configuration'}
            isCollapsed={collapsed}
            onClick={() => handleNavClick('configuration')}
          />
        )}
        {hasPermission('security-group:read') && (
          <NavButton
            icon={<ShieldCheck className="h-5 w-5" />}
            label="Security Groups"
            isActive={activeTab === 'security-groups'}
            isCollapsed={collapsed}
            onClick={() => handleNavClick('security-groups')}
          />
        )}
        {hasPermission('app-updates:upload') && (
          <NavButton
            icon={<RefreshCw className="h-5 w-5" />}
            label="App Update"
            isActive={activeTab === 'app-update'}
            isCollapsed={collapsed}
            onClick={() => handleNavClick('app-update')}
          />
        )}
        {(hasPermission('app-management:read') || hasPermission('app-management:upload') || hasPermission('app-management:deploy')) && (
          <NavButton
            icon={<PackageSearch className="h-5 w-5" />}
            label="App Management"
            isActive={activeTab === 'app-management'}
            isCollapsed={collapsed}
            onClick={() => handleNavClick('app-management')}
          />
        )}
        {(hasPermission('file-manager:read') || hasPermission('file-manager:command')) && (
          <NavButton
            icon={<HardDrive className="h-5 w-5" />}
            label="File Manager"
            isActive={activeTab === 'file-manager'}
            isCollapsed={collapsed}
            onClick={() => handleNavClick('file-manager')}
          />
        )}
      </nav>

      {/* Logout Button */}
      <div className={`p-4 ${collapsed ? 'px-2' : ''}`}>
        <Button
          variant="destructive"
          className={`w-full transition-all duration-300 ${
            collapsed ? 'px-2' : ''
          }`}
          onClick={logout}
        >
          <LogOut className={`h-5 w-5 ${collapsed ? '' : 'mr-2'}`} />
          <span
            className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${
              collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
            }`}
          >
            Logout
          </span>
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Mobile Drawer */}
      <div
        className={`fixed top-0 left-0 h-full z-50 w-72 bg-sidebar text-white flex flex-col transition-transform duration-300 ease-in-out lg:hidden ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Close button */}
        <button
          onClick={onMobileClose}
          className="absolute top-4 right-4 p-1.5 rounded-md bg-white/10 hover:bg-white/20 transition-colors"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>

        {sidebarContent(false)}
      </div>

      {/* Desktop Sidebar */}
      <div
        className={`hidden lg:flex h-screen bg-sidebar text-white flex-col relative transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Collapse Toggle Button */}
        <button
          onClick={toggleSidebar}
          className="absolute -right-3 top-8 bg-sidebar border-2 border-white/20 rounded-full p-1 hover:bg-white/10 transition-colors z-10"
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
    <Button
      variant={isActive ? 'default' : 'ghost'}
      className={`w-full text-white hover:bg-white/10 transition-all duration-300 ${
        isCollapsed ? 'justify-center px-2' : 'justify-start'
      }`}
      onClick={onClick}
      title={isCollapsed ? label : undefined}
    >
      <span className={isCollapsed ? '' : 'mr-3'}>{icon}</span>
      <span
        className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${
          isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
        }`}
      >
        {label}
      </span>
    </Button>
  );
}
