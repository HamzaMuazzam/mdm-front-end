import { useDeferredValue, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BellRing,
  Gauge,
  Layers3,
  MonitorSmartphone,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  MetricTile,
  MiniTrend,
  ScreenIntro,
  SectionCard,
  StatusBadge,
  SurfaceCard,
} from '@/components/workspace/WorkspacePrimitives';
import { useDeviceAnalyticsQuery, useDevicesQuery } from '@/hooks/useDevices';
import { useUserPlanQuery } from '@/hooks/useSubscriptions';
import { useUsersQuery } from '@/hooks/useUsers';
import type { WorkspaceView } from '@/lib/brand';

interface CommandCenterScreenProps {
  searchQuery: string;
  onViewChange: (view: WorkspaceView) => void;
}

function percent(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function formatTimestamp(value?: string) {
  if (!value) return 'Live now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Live now';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function CommandCenterScreen({
  searchQuery,
  onViewChange,
}: CommandCenterScreenProps) {
  const deferredSearch = useDeferredValue(searchQuery);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return window.localStorage.getItem('orbitops.onboarding.dismissed') !== 'true';
  });
  const { data: analytics } = useDeviceAnalyticsQuery();
  const { data: devices = [] } = useDevicesQuery();
  const { data: users = [] } = useUsersQuery();
  const { data: userPlan } = useUserPlanQuery();

  const totalDevices = analytics?.devices.totalDevicesAdded ?? devices.length;
  const onlineDevices = analytics?.connectivity.onlineDevices ?? 0;
  const activeUsers = analytics?.users?.activeUsers ?? users.filter((user) => user.active).length;
  const complianceBaseline = analytics?.devices.verifiedDevices
    ? percent(analytics.devices.verifiedDevices, Math.max(totalDevices, 1))
    : 0;
  const healthScore = Math.round(
    (percent(onlineDevices, Math.max(totalDevices, 1)) +
      complianceBaseline +
      percent(activeUsers, Math.max(users.length, 1))) /
      3
  );

  const search = deferredSearch.trim().toLowerCase();
  const matchingDevices = search
    ? devices
        .filter((device) =>
          [device.deviceName, device.deviceUuid, device.userEmail, device.userName, device.model]
            .filter(Boolean)
            .some((value) => value?.toLowerCase().includes(search))
        )
        .slice(0, 4)
    : [];

  const matchingPeople = search
    ? users
        .filter((user) =>
          [user.userName, user.email, user.phone]
            .filter(Boolean)
            .some((value) => value?.toLowerCase().includes(search))
        )
        .slice(0, 4)
    : [];

  const alertStack = [
    {
      title: 'Devices need attention',
      value: analytics?.devices.unverifiedDevices ?? 0,
      tone: 'warning' as const,
      description: 'Enrollment checks incomplete or awaiting confirmation.',
      action: () => onViewChange('fleet'),
    },
    {
      title: 'Stale sync window',
      value: analytics?.sync.staleSyncDevices ?? 0,
      tone: 'danger' as const,
      description: 'Devices have not reported recently and may need follow-up.',
      action: () => onViewChange('fleet'),
    },
    {
      title: 'Access reviews ready',
      value: Math.max((users.length || 0) - activeUsers, 0),
      tone: 'info' as const,
      description: 'Inactive collaborators and pending access clean-up.',
      action: () => onViewChange('people'),
    },
  ];

  const seatsUsed = analytics?.subscription?.devicesInUse ?? totalDevices;
  const seatsTotal = analytics?.subscription?.allowedDevices ?? userPlan?.subscription?.noOfDevices ?? 0;

  return (
    <div className="space-y-6">
      <ScreenIntro
        eyebrow="Live overview"
        title="Command Center"
        description="A premium control surface for your mobile estate. See health, risk, and operational momentum without leaving the small-screen flow."
        actions={
          <>
            <Button variant="outline" onClick={() => onViewChange('people')}>
              Invite people
            </Button>
            <Button onClick={() => onViewChange('fleet')}>
              Open fleet
              <ArrowRight className="h-4 w-4" />
            </Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.4fr,0.9fr]">
        <SurfaceCard className="overflow-hidden bg-slate-950 text-white shadow-[0_42px_100px_rgba(15,23,42,0.35)]">
          <div className="relative p-6 sm:p-7">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_26%),radial-gradient(circle_at_80%_20%,rgba(21,94,239,0.28),transparent_26%),radial-gradient(circle_at_75%_100%,rgba(255,122,89,0.2),transparent_30%)]" />
            <div className="relative space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone="success">Operational</StatusBadge>
                <StatusBadge tone="info">
                  Updated {formatTimestamp(analytics?.generatedAt)}
                </StatusBadge>
              </div>
              <div className="grid gap-5 lg:grid-cols-[1.1fr,0.9fr]">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.22em] text-white/50">
                      Fleet confidence
                    </p>
                    <h2 className="mt-2 font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
                      {healthScore}%
                    </h2>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-white/72">
                      Online coverage, verified enrollment, and active operator readiness are blended into one score for mobile decision-making.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                        Online
                      </p>
                      <p className="mt-2 text-2xl font-semibold">{onlineDevices}</p>
                    </div>
                    <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                        Verified
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {analytics?.devices.verifiedDevices ?? 0}
                      </p>
                    </div>
                    <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                        Active people
                      </p>
                      <p className="mt-2 text-2xl font-semibold">{activeUsers}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                        Capacity lane
                      </p>
                      <p className="mt-2 font-heading text-3xl font-semibold">
                        {seatsUsed}
                        {seatsTotal ? <span className="text-white/50"> / {seatsTotal}</span> : null}
                      </p>
                    </div>
                    <Layers3 className="h-5 w-5 text-white/70" />
                  </div>
                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-white"
                      style={{
                        width: `${seatsTotal ? percent(seatsUsed, seatsTotal) : 0}%`,
                      }}
                    />
                  </div>
                  <p className="mt-3 text-sm text-white/72">
                    {seatsTotal
                      ? `${seatsTotal - seatsUsed} device slots remain before you hit the current pack limit.`
                      : 'Capacity data will appear once a pack has been assigned.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </SurfaceCard>

        <SectionCard
          title="Next actions"
          description="A tighter onboarding and operations loop, built for admins on the move."
        >
          {showOnboarding ? (
            <div className="space-y-3">
              {[
                {
                  title: 'Enroll your first field device',
                  description: 'Create a device record and connect it to the fleet stream.',
                  action: () => onViewChange('fleet'),
                },
                {
                  title: 'Invite a teammate with scoped access',
                  description: 'Keep onboarding lightweight while still assigning the right rules.',
                  action: () => onViewChange('people'),
                },
                {
                  title: 'Publish a default blueprint',
                  description: 'Set the baseline for connectivity, protection, and user experience.',
                  action: () => onViewChange('rule-studio'),
                },
              ].map((step, index) => (
                <button
                  key={step.title}
                  type="button"
                  onClick={step.action}
                  className="flex w-full items-start gap-4 rounded-[1.4rem] border border-border bg-muted/45 p-4 text-left transition hover:border-border/80 hover:bg-muted/70"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-card text-sm font-semibold text-primary">
                    0{index + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{step.title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </button>
              ))}
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setShowOnboarding(false);
                  window.localStorage.setItem('orbitops.onboarding.dismissed', 'true');
                }}
              >
                Dismiss onboarding
              </Button>
            </div>
          ) : (
            <div className="rounded-[1.4rem] border border-border bg-muted/45 p-5">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-primary" />
                <p className="font-semibold text-foreground">Workspace is ready</p>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                The onboarding flow is tucked away. You can jump straight into fleet operations or refine rules from the studio.
              </p>
              <Button className="mt-4 w-full" onClick={() => onViewChange('rule-studio')}>
                Open rule studio
              </Button>
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Fleet volume"
          value={totalDevices}
          hint="Registered devices across the workspace"
          icon={MonitorSmartphone}
        />
        <MetricTile
          label="Active people"
          value={activeUsers}
          hint="Operators currently enabled"
          icon={UsersRound}
          tone="success"
        />
        <MetricTile
          label="Compliance"
          value={`${complianceBaseline}%`}
          hint="Verified enrollment baseline"
          icon={ShieldCheck}
        />
        <MetricTile
          label="Attention queue"
          value={analytics?.sync.staleSyncDevices ?? 0}
          hint="Devices outside the sync comfort zone"
          icon={ShieldAlert}
          tone="warning"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr,0.85fr]">
        <SectionCard
          title="Movement over the last 7 days"
          description="Enrollment and sync patterns tuned for quick scanning on mobile."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.4rem] border border-border bg-muted/35 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Enrollments</p>
                  <p className="text-xs text-muted-foreground">
                    Daily device additions
                  </p>
                </div>
                <Gauge className="h-5 w-5 text-primary" />
              </div>
              <MiniTrend
                values={(analytics?.enrollmentTrendLast7Days ?? []).map((point) => point.value)}
              />
            </div>
            <div className="rounded-[1.4rem] border border-border bg-muted/35 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Sync rhythm</p>
                  <p className="text-xs text-muted-foreground">
                    Devices reporting in over time
                  </p>
                </div>
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <MiniTrend
                values={(analytics?.syncTrendLast7Days ?? []).map((point) => point.value)}
                color="var(--secondary-solid)"
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Attention queue"
          description="High-signal items that deserve a touchpoint right now."
        >
          <div className="space-y-3">
            {alertStack.map((item) => (
              <button
                key={item.title}
                type="button"
                onClick={item.action}
                className="flex w-full items-start gap-4 rounded-[1.4rem] border border-border bg-muted/40 p-4 text-left transition hover:border-border/80 hover:bg-muted/70"
              >
                <div className="rounded-full bg-card px-3 py-1.5 text-sm font-semibold text-foreground">
                  {item.value}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{item.title}</p>
                    <StatusBadge tone={item.tone}>{item.tone}</StatusBadge>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {item.description}
                  </p>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr,1fr]">
        <SectionCard
          title="Risk posture"
          description="The essentials distilled for leadership and operator review."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.4rem] border border-border bg-muted/35 p-4">
              <BellRing className="h-5 w-5 text-primary" />
              <p className="mt-3 text-2xl font-semibold text-foreground">
                {analytics?.sync.neverSyncedDevices ?? 0}
              </p>
              <p className="text-sm text-muted-foreground">Never synced</p>
            </div>
            <div className="rounded-[1.4rem] border border-border bg-muted/35 p-4">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <p className="mt-3 text-2xl font-semibold text-foreground">
                {analytics?.devices.activeDevices ?? totalDevices}
              </p>
              <p className="text-sm text-muted-foreground">Available to operators</p>
            </div>
            <div className="rounded-[1.4rem] border border-border bg-muted/35 p-4">
              <ShieldAlert className="h-5 w-5 text-primary" />
              <p className="mt-3 text-2xl font-semibold text-foreground">
                {analytics?.devices.inactiveDevices ?? 0}
              </p>
              <p className="text-sm text-muted-foreground">Inactive records</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title={search ? 'Search spotlight' : 'Search-first workspace'}
          description={
            search
              ? 'Matching results from the redesigned workspace surface.'
              : 'Use the universal search above to jump between devices, people, and rule context.'
          }
        >
          {search ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Devices
                </p>
                {matchingDevices.length ? (
                  matchingDevices.map((device) => (
                    <div
                      key={device.id}
                      className="rounded-[1.4rem] border border-border bg-muted/35 p-4"
                    >
                      <p className="font-semibold text-foreground">
                        {device.deviceName || device.model || device.deviceUuid}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {device.userName || device.userEmail || 'Unassigned'}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {device.deviceUuid}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No matching devices.</p>
                )}
              </div>
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  People
                </p>
                {matchingPeople.length ? (
                  matchingPeople.map((person) => (
                    <div
                      key={person.id}
                      className="rounded-[1.4rem] border border-border bg-muted/35 p-4"
                    >
                      <p className="font-semibold text-foreground">
                        {person.userName || person.email}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">{person.email}</p>
                      <div className="mt-3">
                        <StatusBadge tone={person.active ? 'success' : 'warning'}>
                          {person.active ? 'Active' : 'Paused'}
                        </StatusBadge>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No matching people.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-border bg-muted/35 p-6">
              <p className="text-sm leading-6 text-muted-foreground">
                Search is wired into the new workspace shell so operators can move from the command center to a device card, a person record, or rule context without hunting through side menus.
              </p>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
