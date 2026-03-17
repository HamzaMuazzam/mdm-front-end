import { useState, type ReactNode } from 'react';
import { Menu } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

interface DashboardLayoutProps {
  sidebar: (mobileProps: { isMobileOpen: boolean; onMobileClose: () => void }) => ReactNode;
  children: ReactNode;
}

export function DashboardLayout({ sidebar, children }: DashboardLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const user = useAuthStore((state) => state.user);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile top header bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-sidebar flex items-center px-4 gap-3 shadow-md">
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-1 rounded-md hover:bg-white/10 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6 text-white" />
        </button>
        <img src="/tw_logo.png" alt="MDM Portal" className="h-7 w-7" />
        <span className="text-white font-bold">MDM Portal</span>
        <div className="ml-auto">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <span className="text-xs font-bold text-white">
              {user?.email?.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Sidebar (handles its own mobile/desktop rendering) */}
      {sidebar({
        isMobileOpen: mobileMenuOpen,
        onMobileClose: () => setMobileMenuOpen(false),
      })}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-page-bg lg:pt-0 pt-14 pb-6">
        {children}
      </main>
    </div>
  );
}
