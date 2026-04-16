import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Menu,
  MoonStar,
  Settings2,
  ShieldCheck,
  Smartphone,
  SunMedium,
  Users,
  X,
} from 'lucide-react';
import { BrandMark } from '@/components/branding/BrandMark';
import { useBranding } from '@/components/branding/BrandingProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SurfaceCard, StatusBadge } from '@/components/workspace/WorkspacePrimitives';
import { useLogout } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { usePermissionStore } from '@/store/permissionStore';
import { cn } from '@/lib/utils';
import type { WorkspaceView } from '@/lib/brand';

interface WorkspaceShellProps {
  activeView: WorkspaceView;
  onViewChange: (view: WorkspaceView) => void;
  searchPlaceholder: string;
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  header: {
    eyebrow: string;
    title: string;
    description: string;
  };
  children: React.ReactNode;
}

const iconMap = {
  LayoutDashboard,
  Smartphone,
  Users,
  ShieldCheck,
  Settings2,
};

function getInitials(email?: string) {
  if (!email) return '?';
  const [local] = email.split('@');
  return local.slice(0, 2).toUpperCase();
}

export function WorkspaceShell({
  activeView,
  onViewChange,
  searchPlaceholder,
  searchValue,
  onSearchValueChange,
  header,
  children,
}: WorkspaceShellProps) {
  const { branding, resolvedTheme, toggleTheme } = useBranding();
  const hasPermission = usePermissionStore((state) => state.hasPermission);
  const logout = useLogout();
  const user = useAuthStore((state) => state.user);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);

  const visibleNavigation = branding.navigation.filter((item) => {
    if (!item.enabled) return false;
    if (Array.isArray(item.permission)) {
      return item.permission.some((permission) => hasPermission(permission));
    }
    return hasPermission(item.permission);
  });

  useEffect(() => {
    setMobileNavOpen(false);
  }, [activeView]);

  const renderNav = (compact = false) => (
    <nav className={cn('space-y-2', compact && 'space-y-1.5')}>
      {visibleNavigation.map((item) => {
        const Icon = iconMap[item.icon];
        const active = item.key === activeView;

        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onViewChange(item.key)}
            className={cn(
              'group flex w-full items-start gap-3 rounded-[1.5rem] border px-4 py-3 text-left transition duration-150',
              active
                ? 'border-transparent bg-foreground text-background shadow-[0_24px_50px_rgba(15,23,42,0.22)]'
                : 'border-transparent bg-card/55 text-foreground hover:border-border hover:bg-card'
            )}
          >
            <span
              className={cn(
                'mt-0.5 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border transition',
                active
                  ? 'border-white/15 bg-white/10 text-white'
                  : 'border-border bg-muted/60 text-primary'
              )}
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold tracking-tight">{item.label}</span>
              {!compact ? (
                <span
                  className={cn(
                    'mt-1 block text-xs leading-5',
                    active ? 'text-white/70' : 'text-muted-foreground'
                  )}
                >
                  {item.description}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(15,118,110,0.16),transparent_32%),radial-gradient(circle_at_80%_10%,rgba(21,94,239,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(255,122,89,0.14),transparent_28%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-[1600px] gap-6 px-4 pb-24 pt-4 sm:px-6 lg:px-8 lg:pb-8">
        <aside className="hidden w-[292px] flex-shrink-0 lg:flex">
          <div className="sticky top-4 flex h-[calc(100vh-2rem)] w-full flex-col gap-4">
            <SurfaceCard className="border-white/70 bg-slate-950 text-white shadow-[0_40px_90px_rgba(15,23,42,0.35)]">
              <div className="space-y-6 p-6">
                <div className="flex items-start justify-between gap-3">
                  <BrandMark />
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10"
                    aria-label="Toggle theme"
                  >
                    {resolvedTheme === 'dark' ? (
                      <SunMedium className="h-4 w-4" />
                    ) : (
                      <MoonStar className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <div>
                  <p className="text-sm text-white/70">{branding.identity.tagline}</p>
                </div>
                <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
                    Workspace
                  </p>
                  <p className="mt-2 font-heading text-xl font-semibold tracking-tight">
                    {branding.identity.domainLabel}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <StatusBadge tone="success">Live</StatusBadge>
                    <span className="text-xs text-white/60">White-label ready</span>
                  </div>
                </div>
              </div>
            </SurfaceCard>

            <SurfaceCard className="flex-1">
              <div className="flex h-full flex-col p-4">
                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    Navigation
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto pr-1">{renderNav()}</div>
                <div className="mt-4 rounded-[1.5rem] border border-border bg-muted/50 p-4">
                  <p className="text-sm font-semibold text-foreground">Signed in as</p>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{user?.email}</p>
                  <Button
                    variant="outline"
                    className="mt-4 w-full"
                    onClick={logout}
                  >
                    Sign out
                  </Button>
                </div>
              </div>
            </SurfaceCard>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="sticky top-4 z-30 mb-6">
            <SurfaceCard className="glass-panel border-white/60">
              <div className="flex flex-col gap-4 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3 lg:hidden">
                  <button
                    type="button"
                    onClick={() => setMobileNavOpen(true)}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card/80 text-foreground transition hover:bg-muted"
                    aria-label="Open navigation"
                  >
                    <Menu className="h-5 w-5" />
                  </button>
                  <BrandMark size="sm" />
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card/80 text-foreground transition hover:bg-muted"
                    aria-label="Toggle theme"
                  >
                    {resolvedTheme === 'dark' ? (
                      <SunMedium className="h-4 w-4" />
                    ) : (
                      <MoonStar className="h-4 w-4" />
                    )}
                  </button>
                </div>

                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                      {header.eyebrow}
                    </p>
                    <h2 className="mt-1 font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                      {header.title}
                    </h2>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                      {header.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 self-start xl:self-center">
                    <div className="hidden rounded-full border border-border bg-card/70 px-3 py-2 text-sm text-muted-foreground md:flex">
                      <span className="mr-2 font-semibold text-foreground">
                        {getInitials(user?.email)}
                      </span>
                      {user?.email}
                    </div>
                    <Button
                      variant="outline"
                      className="hidden lg:inline-flex"
                      onClick={toggleTheme}
                    >
                      {resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                  <Input
                    value={searchValue}
                    onChange={(event) => onSearchValueChange(event.target.value)}
                    placeholder={searchPlaceholder}
                    className="h-12 rounded-[1.3rem]"
                  />

                  <div className="hidden gap-2 lg:flex">
                    <Button variant="outline" onClick={() => onViewChange('fleet')}>
                      Enroll device
                    </Button>
                    <Button variant="outline" onClick={() => onViewChange('people')}>
                      Invite person
                    </Button>
                    <Button onClick={() => onViewChange('rule-studio')}>Open rules</Button>
                  </div>
                </div>
              </div>
            </SurfaceCard>
          </div>

          <main className="space-y-6">{children}</main>
        </div>
      </div>

      {mobileNavOpen ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-[88vw] max-w-[360px] overflow-y-auto bg-background p-4 lg:hidden">
            <div className="mb-4 flex items-center justify-between">
              <BrandMark />
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {renderNav()}
            <div className="mt-4 rounded-[1.5rem] border border-border bg-card p-4">
              <p className="text-sm font-semibold text-foreground">{user?.email}</p>
              <Button variant="outline" className="mt-4 w-full" onClick={logout}>
                Sign out
              </Button>
            </div>
          </div>
        </>
      ) : null}

      <button
        type="button"
        onClick={() => setMobileActionsOpen((open) => !open)}
        className="fixed bottom-[5.75rem] right-4 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-foreground text-background shadow-[0_20px_45px_rgba(15,23,42,0.28)] lg:hidden"
        aria-label="Open quick actions"
      >
        {mobileActionsOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {mobileActionsOpen ? (
        <div className="fixed bottom-[10.5rem] right-4 z-40 flex w-[220px] flex-col gap-2 lg:hidden">
          <Button variant="outline" className="justify-start bg-card" onClick={() => onViewChange('fleet')}>
            Enroll device
          </Button>
          <Button variant="outline" className="justify-start bg-card" onClick={() => onViewChange('people')}>
            Invite person
          </Button>
          <Button className="justify-start" onClick={() => onViewChange('rule-studio')}>
            Open rules
          </Button>
        </div>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/92 backdrop-blur-xl lg:hidden">
        <div className="grid grid-cols-5 px-2 pb-safe">
          {visibleNavigation.slice(0, 5).map((item) => {
            const Icon = iconMap[item.icon];
            const active = item.key === activeView;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onViewChange(item.key)}
                className="flex min-h-[72px] flex-col items-center justify-center gap-1 px-1"
              >
                <span
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-2xl transition',
                    active
                      ? 'bg-foreground text-background'
                      : 'bg-transparent text-muted-foreground'
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span
                  className={cn(
                    'text-[11px] font-semibold tracking-tight',
                    active ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {item.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
