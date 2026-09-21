import { useMemo, useState } from 'react';
import { AppWindow, Brush, Trash2, KeyRound, Square, Search, Check, Loader2, Monitor, ChevronRight, Plus, X, AlertTriangle, Lock, ArrowLeft } from 'lucide-react';
import type { Device } from '@/types/device.types';
import { useAppCatalog } from '@/hooks/useDevices';
import { useAppControlExecute, useAppControlPreview } from '@/hooks/useAppControl';
import { usePermissionStore } from '@/store/permissionStore';
import { toast } from '@/hooks/useToast';
import { BulkPolicyScaffold, type BulkApplyContext } from '@/components/features/devices/BulkPolicyScaffold';
import { AppControlResults } from './AppControlResults';
import {
  APP_CONTROL_ACTION_LABELS,
  APP_CONTROL_PERMISSIONS,
  type AppControlAction,
  type AppControlPreview,
  type AppControlRequest,
  type PermissionGrantState,
} from '@/types/appControl.types';

export interface AppActionsPreset {
  action?: AppControlAction;
  /** Apps already chosen by the caller (row menu / multi-select). */
  apps?: { appPackageId: string; appName?: string | null }[];
  allUserApps?: boolean;
  /** The device page flow: that device is selected and cannot be unticked. */
  lockedDeviceUuids?: string[];
  initialDeviceUuids?: string[];
  initialGroupIds?: number[];
}

const ACTIONS: { key: AppControlAction; icon: typeof Brush; blurb: string; danger?: boolean }[] = [
  { key: 'CLEAR_CACHE', icon: Brush, blurb: 'Frees space. Logins and data stay.' },
  { key: 'SET_PERMISSIONS', icon: KeyRound, blurb: 'Grant silently — the user is never asked.' },
  { key: 'FORCE_STOP', icon: Square, blurb: 'Closes the app until it is opened again.' },
  { key: 'CLEAR_DATA', icon: Trash2, blurb: 'Resets the app. Users are signed out.', danger: true },
];

const GRANT_STATES: { key: PermissionGrantState; label: string; hint: string }[] = [
  { key: 'GRANT', label: 'Grant', hint: 'Allowed, and the user cannot turn it off' },
  { key: 'DENY', label: 'Deny', hint: 'Blocked, and the user cannot turn it on' },
  { key: 'DEFAULT', label: 'Let user decide', hint: 'Back to the normal Android prompt' },
];

const iconSrc = (b64: string | null | undefined) => (!b64 ? null : b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`);
const splitList = (raw: string) => raw.split(/[\s,;]+/).map((p) => p.trim()).filter(Boolean);

/**
 * The single dialog behind every App Control entry point. Pick an action and apps on the right,
 * groups / devices on the left; "Review" runs a server-side dry run, the confirm step sends, and
 * the dialog then turns into the live results view.
 */
export function AppActionsModal({ devices, preset, onClose }: { devices: Device[]; preset?: AppActionsPreset; onClose: () => void }) {
  const hasPermission = usePermissionStore((s) => s.hasPermission);
  const canClearData = hasPermission(APP_CONTROL_PERMISSIONS.clearData);
  const { data: catalog = [], isLoading: catalogLoading } = useAppCatalog();
  const previewMutation = useAppControlPreview();
  const executeMutation = useAppControlExecute();

  const [action, setAction] = useState<AppControlAction>(preset?.action || 'CLEAR_CACHE');
  const [selected, setSelected] = useState<Set<string>>(() => new Set((preset?.apps || []).map((a) => a.appPackageId)));
  const [allUserApps, setAllUserApps] = useState(!!preset?.allUserApps);
  const [search, setSearch] = useState('');
  const [hideSystem, setHideSystem] = useState(true);
  const [showManual, setShowManual] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [permMode, setPermMode] = useState<'ALL_REQUESTED' | 'SELECTED'>('ALL_REQUESTED');
  const [permNames, setPermNames] = useState<string[]>([]);
  const [permInput, setPermInput] = useState('');
  const [grantState, setGrantState] = useState<PermissionGrantState>('GRANT');

  const [pending, setPending] = useState<{ request: AppControlRequest; preview: AppControlPreview } | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [batchId, setBatchId] = useState<number | null>(null);

  const allAppsAllowed = action === 'CLEAR_CACHE' || action === 'FORCE_STOP';
  const useAllApps = allUserApps && allAppsAllowed;
  const presetNames = useMemo(() => Object.fromEntries((preset?.apps || []).map((a) => [a.appPackageId, a.appName || ''])), [preset]);

  const visibleCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.filter((app) => {
      if (selected.has(app.appPackageId)) return true;
      if (hideSystem && app.isSystemApp) return false;
      return !q || (app.appName || '').toLowerCase().includes(q) || app.appPackageId.toLowerCase().includes(q);
    });
  }, [catalog, search, hideSystem, selected]);

  /** Selected ids that are not in the catalog (typed manually, or a not-yet-synced preset). */
  const extraSelected = useMemo(() => {
    const known = new Set(catalog.map((a) => a.appPackageId));
    return Array.from(selected).filter((id) => !known.has(id));
  }, [catalog, selected]);

  const toggle = (pkg: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(pkg) ? next.delete(pkg) : next.add(pkg);
      return next;
    });

  const addManual = () => {
    const ids = splitList(manualInput);
    if (!ids.length) return;
    setSelected((prev) => new Set([...prev, ...ids]));
    setManualInput('');
  };

  const addPermissions = () => {
    const names = splitList(permInput).map((n) => (n.includes('.') ? n : `android.permission.${n.toUpperCase()}`));
    if (!names.length) return;
    setPermNames((prev) => Array.from(new Set([...prev, ...names])));
    setPermInput('');
  };

  const appsReady = useAllApps || selected.size > 0;
  const permsReady = action !== 'SET_PERMISSIONS' || permMode === 'ALL_REQUESTED' || permNames.length > 0;

  const handleReview = async ({ target }: BulkApplyContext) => {
    const request: AppControlRequest = {
      action,
      target,
      ...(useAllApps ? { allUserApps: true } : { appPackageIds: Array.from(selected) }),
      ...(action === 'SET_PERMISSIONS'
        ? { permissions: { mode: permMode, state: grantState, ...(permMode === 'SELECTED' ? { names: permNames } : {}) } }
        : {}),
    };
    try {
      const preview = await previewMutation.mutateAsync(request);
      setConfirmText('');
      setPending({ request, preview });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Could not prepare this action', description: error?.response?.data?.message || 'Please try again.' });
    }
  };

  const handleSend = async () => {
    if (!pending) return;
    try {
      const batch = await executeMutation.mutateAsync(pending.request);
      setBatchId(batch.id);
      setPending(null);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Could not send', description: error?.response?.data?.message || 'Please try again.' });
    }
  };

  // ── 3. Live results ─────────────────────────────────────────────────────────
  if (batchId != null) {
    return (
      <Shell title={`${APP_CONTROL_ACTION_LABELS[action]} — results`} subtitle="You can close this; results stay under Device Groups → App Actions history." onClose={onClose}>
        <AppControlResults batchId={batchId} />
        <div className="flex shrink-0 justify-end border-t border-border px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Done</button>
        </div>
      </Shell>
    );
  }

  // ── 2. Review & confirm ─────────────────────────────────────────────────────
  if (pending) {
    const p = pending.preview;
    const danger = action === 'CLEAR_DATA';
    const needsTyping = danger && p.devicesWithWork > 10;
    const confirmed = !needsTyping || confirmText.trim() === String(p.devicesWithWork);
    const appLabel = useAllApps ? 'all user apps' : p.apps.filter((a) => !a.protectedPackage).map((a) => a.appName || a.appPackageId).slice(0, 4).join(', ') + (p.apps.length > 4 ? ` +${p.apps.length - 4} more` : '');
    return (
      <Shell title="Review" subtitle="Nothing has been sent yet" onClose={onClose} narrow>
        <div className="space-y-4 overflow-y-auto px-5 py-5">
          <p className="text-sm leading-relaxed text-gray-800">
            <span className="font-semibold">{APP_CONTROL_ACTION_LABELS[action]}</span>
            {action === 'SET_PERMISSIONS' && (
              <> ({GRANT_STATES.find((g) => g.key === grantState)?.label.toLowerCase()} {permMode === 'ALL_REQUESTED' ? 'everything the app asks for' : `${permNames.length} permission${permNames.length === 1 ? '' : 's'}`})</>
            )}{' '}
            of <span className="font-semibold">{appLabel}</span> on{' '}
            <span className="font-semibold">{p.devicesWithWork} device{p.devicesWithWork === 1 ? '' : 's'}</span>
            <span className="text-muted-foreground"> — {p.targetDescription}</span>
          </p>

          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat value={p.commandsToSend} label="commands to send" />
            <Stat value={p.skippedNotInstalled} label="skipped, app not installed" muted />
            <Stat value={p.devicesLikelyUnsupported} label="may not support it" warn={p.devicesLikelyUnsupported > 0} />
          </div>

          {p.devicesLikelyUnsupported > 0 && p.unsupportedReason && <Note tone="warn">{p.unsupportedReason} Those devices will answer "Not supported" — nothing breaks.</Note>}
          {p.protectedPackages.length > 0 && (
            <Note tone="muted"><Lock className="mr-1 inline h-3 w-3" />Protected and left out: <span className="font-mono">{p.protectedPackages.join(', ')}</span></Note>
          )}
          {p.commandsToSend === 0 && <Note tone="warn">None of the selected devices has the selected app(s) installed — there is nothing to send.</Note>}
          {danger && p.commandsToSend > 0 && (
            <Note tone="bad">
              <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
              This deletes all data of the app(s) on those devices. Users are signed out and unsynced work is lost. It cannot be undone.
            </Note>
          )}
          {needsTyping && (
            <label className="block text-xs text-gray-700">
              Type <span className="font-semibold">{p.devicesWithWork}</span> (the number of devices) to confirm
              <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} inputMode="numeric" className="mt-1 h-9 w-full rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
            </label>
          )}
        </div>
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-5 py-4">
          <button type="button" onClick={() => setPending(null)} className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!confirmed || p.commandsToSend === 0 || executeMutation.isPending}
            className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {executeMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {APP_CONTROL_ACTION_LABELS[action]} now
          </button>
        </div>
      </Shell>
    );
  }

  // ── 1. Choose ───────────────────────────────────────────────────────────────
  return (
    <BulkPolicyScaffold
      title="App Actions"
      subtitle="Clear cache, clear data, permissions or force stop — on any apps, any devices"
      icon={AppWindow}
      devices={devices}
      isPending={previewMutation.isPending}
      canApply={appsReady && permsReady}
      applyVerb="Review — apply"
      onApply={handleReview}
      onClose={onClose}
      lockedDeviceUuids={preset?.lockedDeviceUuids}
      initialDeviceUuids={preset?.initialDeviceUuids}
      initialGroupIds={preset?.initialGroupIds}
      maxWidthClass="max-w-5xl"
    >
      <div className="-mx-5 -my-5 flex h-full min-h-[26rem] flex-col">
        <div className="shrink-0 space-y-3 border-b border-border px-5 pb-3 pt-4">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {ACTIONS.map(({ key, icon: Icon, blurb, danger }) => {
              const locked = key === 'CLEAR_DATA' && !canClearData;
              const active = action === key;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={locked}
                  title={locked ? 'Needs the "app-control:clear-data" permission' : undefined}
                  onClick={() => setAction(key)}
                  className={`rounded-lg border p-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    active ? (danger ? 'border-red-300 bg-red-50' : 'border-blue-300 bg-blue-50') : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className={`flex items-center gap-1.5 text-sm font-semibold ${active ? (danger ? 'text-red-700' : 'text-blue-700') : 'text-gray-800'}`}>
                    <Icon className="h-3.5 w-3.5" /> {APP_CONTROL_ACTION_LABELS[key]}
                    {locked && <Lock className="h-3 w-3" />}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{blurb}</p>
                </button>
              );
            })}
          </div>

          {action === 'SET_PERMISSIONS' && (
            <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50/60 p-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                {GRANT_STATES.map((g) => (
                  <button key={g.key} type="button" title={g.hint} onClick={() => setGrantState(g.key)}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium ${grantState === g.key ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}>
                    {g.label}
                  </button>
                ))}
                <span className="mx-1 h-4 w-px bg-gray-300" />
                <label className="flex items-center gap-1.5 text-xs text-gray-700">
                  <input type="radio" checked={permMode === 'ALL_REQUESTED'} onChange={() => setPermMode('ALL_REQUESTED')} /> Everything the app asks for
                </label>
                <label className="flex items-center gap-1.5 text-xs text-gray-700">
                  <input type="radio" checked={permMode === 'SELECTED'} onChange={() => setPermMode('SELECTED')} /> Only these
                </label>
              </div>
              {permMode === 'SELECTED' && (
                <div className="space-y-1.5">
                  <div className="flex gap-2">
                    <input
                      value={permInput}
                      onChange={(e) => setPermInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPermissions(); } }}
                      placeholder="Permission names, e.g. CAMERA  (short or full android.permission.… form)"
                      className="h-8 flex-1 rounded-md border border-gray-300 bg-white px-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button type="button" onClick={addPermissions} disabled={!permInput.trim()} className="inline-flex h-8 items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                      <Plus className="h-3 w-3" /> Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {permNames.map((n) => (
                      <span key={n} className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-0.5 font-mono text-[11px] text-gray-700">
                        {n.replace('android.permission.', '')}
                        <button type="button" onClick={() => setPermNames((prev) => prev.filter((x) => x !== n))} className="text-gray-400 hover:text-red-600"><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">Only runtime permissions an app really declares are touched; the rest is reported as skipped.</p>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={useAllApps}
                placeholder="Search apps by name or package id…"
                className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-8 pr-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-50"
              />
            </div>
            <label className="flex shrink-0 items-center gap-1.5 text-xs text-gray-600">
              <input type="checkbox" checked={hideSystem} onChange={(e) => setHideSystem(e.target.checked)} /> Hide system apps
            </label>
          </div>
          {allAppsAllowed && (
            <label className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs ${useAllApps ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-gray-200 text-gray-700'}`}>
              <input type="checkbox" checked={allUserApps} onChange={(e) => setAllUserApps(e.target.checked)} />
              <span className="font-medium">All user apps</span>
              <span className="text-muted-foreground">— every non-system app on each selected device</span>
            </label>
          )}
        </div>

        <div className={`min-h-0 flex-1 divide-y divide-border overflow-y-auto ${useAllApps ? 'pointer-events-none opacity-40' : ''}`}>
          {extraSelected.map((pkg) => (
            <AppRow key={pkg} selected name={presetNames[pkg] || pkg} pkg={pkg} onClick={() => toggle(pkg)} badge="not in catalog" />
          ))}
          {catalogLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading app catalog…</div>
          ) : visibleCatalog.length === 0 && extraSelected.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">{catalog.length === 0 ? 'No apps synced from devices yet' : 'No apps match'}</div>
          ) : (
            visibleCatalog.map((app) => (
              <AppRow
                key={app.appPackageId}
                selected={selected.has(app.appPackageId)}
                name={app.appName || app.appPackageId}
                pkg={app.appPackageId}
                icon={iconSrc(app.appIconBase64)}
                system={app.isSystemApp}
                badge={`${app.deviceCount} device${app.deviceCount === 1 ? '' : 's'}`}
                onClick={() => toggle(app.appPackageId)}
              />
            ))
          )}
        </div>

        <div className="shrink-0 space-y-2 border-t border-border px-5 py-2.5">
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setShowManual((v) => !v)} className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700">
              <ChevronRight className={`h-3.5 w-3.5 transition-transform ${showManual ? 'rotate-90' : ''}`} /> Add package id manually
            </button>
            <p className="text-xs text-muted-foreground">
              {useAllApps ? 'All user apps' : <><span className="font-semibold text-foreground">{selected.size}</span> app{selected.size === 1 ? '' : 's'} selected</>}
            </p>
          </div>
          {showManual && (
            <div className="flex gap-2">
              <input
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addManual(); } }}
                placeholder="com.example.app (comma / space separated)"
                className="h-8 flex-1 rounded-md border border-gray-300 bg-white px-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button type="button" onClick={addManual} disabled={!manualInput.trim()} className="inline-flex h-8 items-center gap-1 rounded-md border border-gray-300 px-2.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                <Plus className="h-3 w-3" /> Add
              </button>
            </div>
          )}
        </div>
      </div>
    </BulkPolicyScaffold>
  );
}

function AppRow({ selected, name, pkg, icon, system, badge, onClick }: { selected: boolean; name: string; pkg: string; icon?: string | null; system?: boolean; badge?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center gap-3 px-5 py-2 text-left transition-colors ${selected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
      <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 ${selected ? 'border-blue-600 bg-blue-600' : 'border-gray-300 bg-white'}`}>
        {selected && <Check className="h-2.5 w-2.5 text-white" />}
      </div>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-blue-50">
        {icon ? <img src={icon} alt="" className="h-full w-full object-cover" /> : <span className="text-xs font-semibold text-blue-600">{name.charAt(0).toUpperCase()}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{name}</p>
        <p className="truncate font-mono text-[11px] text-muted-foreground">{pkg}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {system && <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600"><Monitor className="h-3 w-3" />System</span>}
        {badge && <span className="rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">{badge}</span>}
      </div>
    </button>
  );
}

function Stat({ value, label, muted, warn }: { value: number; label: string; muted?: boolean; warn?: boolean }) {
  return (
    <div className={`rounded-lg border px-2 py-2 ${warn ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
      <p className={`text-lg font-semibold ${warn ? 'text-amber-700' : muted ? 'text-gray-500' : 'text-gray-900'}`}>{value}</p>
      <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}

function Note({ tone, children }: { tone: 'warn' | 'bad' | 'muted'; children: React.ReactNode }) {
  const cls = tone === 'bad' ? 'border-red-200 bg-red-50 text-red-800' : tone === 'warn' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-gray-200 bg-gray-50 text-gray-700';
  return <p className={`rounded-md border px-3 py-2 text-xs leading-relaxed ${cls}`}>{children}</p>;
}

/** Same bottom-sheet-on-mobile / centred-on-desktop frame the bulk scaffold uses. */
export function Shell({ title, subtitle, onClose, narrow, children }: { title: string; subtitle?: string; onClose: () => void; narrow?: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 lg:items-center lg:p-4">
      <div className={`flex max-h-[92vh] w-full ${narrow ? 'max-w-lg' : 'max-w-3xl'} flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl animate-sheet-up pb-safe lg:animate-none lg:rounded-lg lg:pb-0`}>
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 pb-4 pt-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
