import { useMemo, useState } from 'react';
import { AppWindow, Loader2, Search, Check, Plus, Trash2, Shield, ShieldOff, Monitor, ChevronRight } from 'lucide-react';
import type { Device } from '@/types/device.types';
import { useAppCatalog, useBulkAppBlock } from '@/hooks/useDevices';
import { toast } from '@/hooks/useToast';
import { BulkPolicyScaffold, type BulkApplyContext } from './BulkPolicyScaffold';

const getBase64ImageSrc = (base64: string | null | undefined): string | null => {
  if (!base64) return null;
  if (base64.startsWith('data:')) return base64;
  return `data:image/png;base64,${base64}`;
};

/**
 * Bulk block/unblock applications on groups and/or devices.
 * Target selection comes from the shared scaffold; apps are picked from the fleet-wide distinct
 * app catalog, with a manual package-id input as a fallback for apps not yet synced.
 * Package ids not installed on a given device are skipped for that device.
 */
export function BulkAppBlockModal({
  devices,
  onClose,
  lockedDeviceUuids,
}: {
  devices: Device[];
  onClose: () => void;
  /** "Apply to more devices…" from a device page: that device is pre-selected and locked. */
  lockedDeviceUuids?: string[];
}) {
  const bulkMutation = useBulkAppBlock();
  const { data: catalog = [], isLoading: catalogLoading } = useAppCatalog();

  const [mode, setMode] = useState<'block' | 'unblock'>('block');
  const [selectedPkgs, setSelectedPkgs] = useState<Set<string>>(new Set());
  const [appSearch, setAppSearch] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [customPkgs, setCustomPkgs] = useState<string[]>([]);
  const [packageInput, setPackageInput] = useState('');

  const filteredCatalog = useMemo(() => {
    const q = appSearch.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(
      (app) => (app.appName || '').toLowerCase().includes(q) || app.appPackageId.toLowerCase().includes(q)
    );
  }, [catalog, appSearch]);

  const togglePkg = (pkg: string) =>
    setSelectedPkgs((prev) => {
      const next = new Set(prev);
      next.has(pkg) ? next.delete(pkg) : next.add(pkg);
      return next;
    });

  /** Accepts one or many package ids separated by commas, spaces, or newlines. */
  const addPackages = () => {
    const parsed = packageInput
      .split(/[\s,;]+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (parsed.length === 0) return;
    setCustomPkgs((prev) => Array.from(new Set([...prev, ...parsed])));
    setPackageInput('');
  };

  const removeCustom = (pkg: string) => setCustomPkgs((prev) => prev.filter((p) => p !== pkg));

  const allPackageIds = useMemo(() => Array.from(new Set([...selectedPkgs, ...customPkgs])), [selectedPkgs, customPkgs]);

  const handleApply = async ({ target }: BulkApplyContext) => {
    if (allPackageIds.length === 0) return;
    try {
      const results = await bulkMutation.mutateAsync({
        target,
        appPackageIds: allPackageIds,
        isAllowed: mode === 'unblock',
      });
      const ok = results.filter((r) => r.success).length;
      const failed = results.length - ok;
      const updated = results.reduce((sum, r) => sum + (r.updated || 0), 0);
      toast({
        variant: failed === 0 ? 'success' : 'destructive',
        title: mode === 'block' ? 'Bulk app block applied' : 'Bulk app unblock applied',
        description: `${ok} device(s) processed, ${updated} app(s) ${mode === 'block' ? 'blocked' : 'unblocked'}${failed ? `, ${failed} failed` : ''}.`,
      });
      if (failed === 0) onClose();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Bulk error',
        description: error?.response?.data?.message || 'Failed to apply app block changes.',
      });
    }
  };

  return (
    <BulkPolicyScaffold
      title="Bulk App Block"
      subtitle="Block or unblock apps on groups or devices"
      icon={AppWindow}
      devices={devices}
      isPending={bulkMutation.isPending}
      canApply={allPackageIds.length > 0}
      applyVerb={`${mode === 'block' ? 'Block' : 'Unblock'} ${allPackageIds.length} app${allPackageIds.length === 1 ? '' : 's'}`}
      onApply={handleApply}
      onClose={onClose}
      lockedDeviceUuids={lockedDeviceUuids}
      maxWidthClass="max-w-5xl"
    >
      <div className="-mx-5 -my-5 flex h-full min-h-[24rem] flex-col">
        <div className="shrink-0 space-y-3 border-b border-border px-5 pb-3 pt-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode('block')}
              className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                mode === 'block' ? 'border-red-300 bg-red-50 text-red-700' : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <ShieldOff className="h-4 w-4" /> Block apps
            </button>
            <button
              type="button"
              onClick={() => setMode('unblock')}
              className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                mode === 'unblock' ? 'border-green-300 bg-green-50 text-green-700' : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Shield className="h-4 w-4" /> Unblock apps
            </button>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search apps by name or package id…"
              value={appSearch}
              onChange={(e) => setAppSearch(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-8 pr-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* App list */}
        <div className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
          {catalogLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading app catalog…
            </div>
          ) : filteredCatalog.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              {catalog.length === 0 ? 'No apps synced from devices yet' : 'No apps match your search'}
            </div>
          ) : (
            filteredCatalog.map((app) => {
              const isSel = selectedPkgs.has(app.appPackageId);
              const iconSrc = getBase64ImageSrc(app.appIconBase64);
              return (
                <button
                  key={app.appPackageId}
                  type="button"
                  onClick={() => togglePkg(app.appPackageId)}
                  className={`flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors ${isSel ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                >
                  <div
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                      isSel ? 'border-blue-600 bg-blue-600' : 'border-gray-300 bg-white'
                    }`}
                  >
                    {isSel && <Check className="h-2.5 w-2.5 text-white" />}
                  </div>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-blue-50">
                    {iconSrc ? (
                      <img src={iconSrc} alt={app.appName} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs font-semibold text-blue-600">{(app.appName || '?').charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{app.appName || app.appPackageId}</p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">{app.appPackageId}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {app.isSystemApp && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                        <Monitor className="h-3 w-3" />
                        System
                      </span>
                    )}
                    <span className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                      {app.deviceCount} device{app.deviceCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Manual fallback */}
        <div className="shrink-0 space-y-2 border-t border-border px-5 py-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowManual((v) => !v)}
              className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              <ChevronRight className={`h-3.5 w-3.5 transition-transform ${showManual ? 'rotate-90' : ''}`} />
              Add package id manually
            </button>
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{allPackageIds.length}</span> app{allPackageIds.length !== 1 ? 's' : ''} selected
            </p>
          </div>
          {showManual && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="com.example.app (comma / space / newline separated)"
                  value={packageInput}
                  onChange={(e) => setPackageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addPackages();
                    }
                  }}
                  className="h-8 flex-1 rounded-md border border-gray-300 bg-white px-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={addPackages}
                  disabled={!packageInput.trim()}
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-gray-300 px-2.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <Plus className="h-3 w-3" /> Add
                </button>
              </div>
              {customPkgs.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {customPkgs.map((pkg) => (
                    <span
                      key={pkg}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 font-mono text-[11px] text-gray-700"
                    >
                      {pkg}
                      <button type="button" onClick={() => removeCustom(pkg)} className="text-gray-400 hover:text-red-600">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </BulkPolicyScaffold>
  );
}
