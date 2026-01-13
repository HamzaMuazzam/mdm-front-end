import { useAuthStore } from '@/store/authStore';
import { useLogout } from '@/hooks/useAuth';
import { USER_LEVELS } from '@/utils/constants';
import { Button } from '@/components/ui/button';

interface SidebarProps {
  activeTab: 'users' | 'devices' | 'subscriptions';
  onTabChange: (tab: 'users' | 'devices' | 'subscriptions') => void;
}

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const user = useAuthStore((state) => state.user);
  const logout = useLogout();

  return (
    <div className="w-64 h-screen bg-sidebar text-white p-6 flex flex-col">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">MDM Portal</h1>
      </div>

      <div className="mb-8 p-4 bg-white/10 rounded-lg">
        <p className="text-sm text-gray-300">Signed in as</p>
        <p className="font-medium truncate">{user?.email}</p>
        <p className="text-xs text-gray-400 mt-1">Level: {user?.userLevel}</p>
      </div>

      <nav className="flex-1 space-y-2">
        {user?.userLevel === USER_LEVELS.L1 && (
          <>
            <Button
              variant={activeTab === 'users' ? 'default' : 'ghost'}
              className="w-full justify-start text-white hover:bg-white/10"
              onClick={() => onTabChange('users')}
            >
              Users
            </Button>
            <Button
              variant={activeTab === 'subscriptions' ? 'default' : 'ghost'}
              className="w-full justify-start text-white hover:bg-white/10"
              onClick={() => onTabChange('subscriptions')}
            >
              Subscriptions
            </Button>
          </>
        )}
        <Button
          variant={activeTab === 'devices' ? 'default' : 'ghost'}
          className="w-full justify-start text-white hover:bg-white/10"
          onClick={() => onTabChange('devices')}
        >
          Devices
        </Button>
      </nav>

      <Button variant="destructive" className="w-full mt-auto" onClick={logout}>
        Logout
      </Button>
    </div>
  );
}
