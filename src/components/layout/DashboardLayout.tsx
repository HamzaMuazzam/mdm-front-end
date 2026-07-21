import { useState, type ReactNode } from 'react';
import { Menu } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

interface DashboardLayoutProps {
  sidebar: (mobileProps: { isMobileOpen: boolean; onMobileClose: () => void }) => ReactNode;
  children: ReactNode;
  /** Mobile app-bar title (< lg only). Falls back to "MDM Portal". */
  title?: string;
  /** Mobile bottom navigation (< lg only). Rendered fixed at the bottom. */
  bottomNav?: ReactNode;
}

export function DashboardLayout({ sidebar, children, title, bottomNav }: DashboardLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const user = useAuthStore((state) => state.user);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile app bar (hidden at >= lg) */}
      <div className="lg:hidden no-press fixed top-0 left-0 right-0 z-30 pt-safe bg-white/95 backdrop-blur-md border-b border-gray-200">
        <div className="h-14 flex items-center pl-1.5 pr-3 gap-1.5">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="h-11 w-11 flex items-center justify-center rounded-full text-gray-600 active:bg-gray-100 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <img src="/tw_logo.png" alt="MDM Portal" className="h-7 w-7" />
          <span className="text-gray-900 font-semibold text-[17px] truncate">
            {title ?? 'MDM Portal'}
          </span>
          <div className="ml-auto">
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-xs font-semibold text-blue-700">
                {user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar (handles its own mobile/desktop rendering) */}
      {sidebar({
        isMobileOpen: mobileMenuOpen,
        onMobileClose: () => setMobileMenuOpen(false),
      })}

      {/* Main content */}
      <main
        className={`flex-1 overflow-y-auto bg-page-bg lg:pt-0 pt-[calc(3.5rem+env(safe-area-inset-top))] ${
          bottomNav
            ? 'pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-6'
            : 'pb-6'
        }`}
      >
        {children}
      </main>

      {/* Mobile bottom navigation (component itself is lg:hidden) */}
      {bottomNav}
    </div>
  );
}
