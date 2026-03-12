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
} from 'lucide-react';

interface SidebarProps {
  activeTab: 'analytics' | 'users' | 'devices' | 'subscriptions' | 'configuration' | 'security-groups' | 'app-update';
  onTabChange: (tab: 'analytics' | 'users' | 'devices' | 'subscriptions' | 'configuration' | 'security-groups' | 'app-update') => void;
}

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const user = useAuthStore((state) => state.user);
  const logout = useLogout();
  const hasPermission = usePermissionStore((state) => state.hasPermission);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div
      className={`h-screen bg-sidebar text-white flex flex-col relative transition-all duration-300 ease-in-out ${
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

      {/* Logo Section */}
      <div className={`p-6 ${isCollapsed ? 'px-4' : ''}`}>
        <div className={`flex flex-col items-center justify-center space-y-2 ${isCollapsed ? 'space-y-0' : ''}`}>
          <img
            src="/tw_logo.png"
            alt="MDM Portal"
            className={`transition-all duration-300 ${isCollapsed ? 'h-8 w-8' : 'h-10 w-auto'}`}
          />
          <h1
            className={`text-2xl font-bold whitespace-nowrap overflow-hidden transition-all duration-300 ${
              isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
            }`}
          >
            MDM Portal
          </h1>
        </div>
      </div>

      {/* User Info Section */}
      <div className={`mx-4 mb-6 p-3 bg-white/10 rounded-lg overflow-hidden transition-all duration-300 ${
        isCollapsed ? 'mx-2 p-2' : ''
      }`}>
        {isCollapsed ? (
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
      <nav className={`flex-1 space-y-2 ${isCollapsed ? 'px-2' : 'px-4'}`}>
        {hasPermission('user:analytics') && (
          <NavButton
            icon={<LayoutDashboard className="h-5 w-5" />}
            label="Analytics"
            isActive={activeTab === 'analytics'}
            isCollapsed={isCollapsed}
            onClick={() => onTabChange('analytics')}
          />
        )}
        {hasPermission('user:read') && (
          <NavButton
            icon={<Users className="h-5 w-5" />}
            label="Users"
            isActive={activeTab === 'users'}
            isCollapsed={isCollapsed}
            onClick={() => onTabChange('users')}
          />
        )}
        {hasPermission('subscriptions:read') && (
          <NavButton
            icon={<CreditCard className="h-5 w-5" />}
            label="Subscriptions"
            isActive={activeTab === 'subscriptions'}
            isCollapsed={isCollapsed}
            onClick={() => onTabChange('subscriptions')}
          />
        )}
        {hasPermission('devices:read') && (
          <NavButton
            icon={<Smartphone className="h-5 w-5" />}
            label="Devices"
            isActive={activeTab === 'devices'}
            isCollapsed={isCollapsed}
            onClick={() => onTabChange('devices')}
          />
        )}
        {hasPermission('configuration:read') && (
          <NavButton
            icon={<Settings className="h-5 w-5" />}
            label="Configuration"
            isActive={activeTab === 'configuration'}
            isCollapsed={isCollapsed}
            onClick={() => onTabChange('configuration')}
          />
        )}
        {hasPermission('security-group:read') && (
          <NavButton
            icon={<ShieldCheck className="h-5 w-5" />}
            label="Security Groups"
            isActive={activeTab === 'security-groups'}
            isCollapsed={isCollapsed}
            onClick={() => onTabChange('security-groups')}
          />
        )}
        {hasPermission('app-updates:upload') && (
          <NavButton
            icon={<RefreshCw className="h-5 w-5" />}
            label="App Update"
            isActive={activeTab === 'app-update'}
            isCollapsed={isCollapsed}
            onClick={() => onTabChange('app-update')}
          />
        )}
      </nav>

      {/* Logout Button */}
      <div className={`p-4 ${isCollapsed ? 'px-2' : ''}`}>
        <Button
          variant="destructive"
          className={`w-full transition-all duration-300 ${
            isCollapsed ? 'px-2' : ''
          }`}
          onClick={logout}
        >
          <LogOut className={`h-5 w-5 ${isCollapsed ? '' : 'mr-2'}`} />
          <span
            className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${
              isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
            }`}
          >
            Logout
          </span>
        </Button>
      </div>
    </div>
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
