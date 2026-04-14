import { useState, type ReactNode } from 'react';
import { Menu, Bell, Search } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { nexusTheme } from '@/lib/theme';

interface DashboardLayoutProps {
  sidebar: (mobileProps: { isMobileOpen: boolean; onMobileClose: () => void }) => ReactNode;
  children: ReactNode;
  /** Tab label shown in mobile top bar */
  pageTitle?: string;
}

function getInitials(email?: string): string {
  if (!email) return '?';
  const [local] = email.split('@');
  const parts = local.split(/[._-]/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

export function DashboardLayout({ sidebar, children, pageTitle }: DashboardLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const user = useAuthStore((s) => s.user);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* ── Sidebar (handles own mobile / desktop rendering) ───── */}
      {sidebar({
        isMobileOpen: mobileMenuOpen,
        onMobileClose: () => setMobileMenuOpen(false),
      })}

      {/* ── Main content column ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── Mobile top bar (hidden on lg+) ──────────────────── */}
        <header className="lg:hidden flex-shrink-0 flex items-center h-14 px-4 gap-3 bg-[#0f172a] shadow-md z-30">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2 mr-auto">
            <div className="w-7 h-7 rounded-lg nexus-gradient flex items-center justify-center">
              <span className="text-white font-bold text-xs">N</span>
            </div>
            <span className="text-white font-bold text-sm tracking-tight">
              {pageTitle ?? nexusTheme.brand.name}
            </span>
          </div>

          <button
            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </button>

          <button
            className="relative p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
          </button>

          {/* User avatar */}
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">{getInitials(user?.email)}</span>
          </div>
        </header>

        {/* ── Desktop top bar (hidden on mobile) ──────────────── */}
        <header className="hidden lg:flex flex-shrink-0 items-center h-14 px-6 gap-4 bg-surface border-b border-border/70">
          {/* Search bar */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search devices, users, apps…"
                className="w-full h-9 pl-9 pr-4 text-sm bg-muted/60 border border-border rounded-xl placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              className="relative p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
            </button>

            {/* User chip */}
            <div className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl bg-muted/60 hover:bg-muted transition-colors cursor-default">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                <span className="text-white text-xs font-bold">{getInitials(user?.email)}</span>
              </div>
              <span className="text-sm font-medium text-foreground/80 max-w-[120px] truncate">
                {user?.email?.split('@')[0]}
              </span>
            </div>
          </div>
        </header>

        {/* ── Scrollable content area ──────────────────────────── */}
        <main className="flex-1 overflow-y-auto bg-background pb-16 lg:pb-0">
          {children}
        </main>
      </div>
    </div>
  );
}
