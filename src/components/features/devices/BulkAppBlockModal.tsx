import { useMemo, useState } from 'react';
import { AppWindow, X, Loader2, Search, Check, CheckSquare, Square, Users, Plus, Trash2, Shield, ShieldOff, Monitor, ChevronRight } from 'lucide-react';
import type { Device } from '@/types/device.types';
import { useAppCatalog, useBulkAppBlock } from '@/hooks/useDevices';
import { toast } from '@/hooks/useToast';

const getBase64ImageSrc = (base64: string | null | undefined): string | null => {
  if (!base64) return null;
  if (base64.startsWith('data:')) return base64;
  return `data:image/png;base64,${base64}`;
};

/**
 * Bulk block/unblock applications on one or many devices at once.
 * Apps are picked from the fleet-wide distinct app catalog; a manual
 * package-id input is available as a fallback for apps not yet synced.
 * Package ids not installed on a given device are skipped for that device.
 */
export function BulkAppBlockModal({ devices, onClose }: { devices: Device[]; onClose: () => void }) {
  const bulkMutation = useBulkAppBlock();
  const { data: catalog = [], isLoading: catalogLoading } = useAppCatalog();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const [mode, setMode] = useState<'block' | 'unblock'>('block');
  const [selectedPkgs, setSelectedPkgs] = useState<Set<string>>(new Set());
  const [appSearch, setAppSearch] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [customPkgs, setCustomPkgs] = useState<string[]>([]);
  const [packageInput, setPackageInput] = useState('');

  // ── Devices pane ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return devices;
    return devices.filter(
      (d) =>
        (d.deviceName || '').toLowerCase().includes(q) ||
        (d.userEmail || '').toLowerCase().includes(q) ||
        d.deviceUuid.toLowerCase().includes(q)
    );
  }, [devices, search]);

  const allSelected = filtered.length > 0 && selected.size === filtered.length;

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(filtered.map((d) => d.deviceUuid)));

  const toggleOne = (uuid: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(uuid) ? next.delete(uuid) : next.add(uuid);
      return next;
    });

  // ── App picker ───────────────────────────────────────────────────────────
  const filteredCatalog = useMemo(() => {
    const q = appSearch.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(
      (app) =>
        (app.appName || '').toLowerCase().includes(q) ||
        app.appPackageId.toLowerCase().includes(q)
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

  const allPackageIds = useMemo(
    () => Array.from(new Set([...selectedPkgs, ...customPkgs])),
    [selectedPkgs, customPkgs]
  );

  const canApply = selected.size > 0 && allPackageIds.length > 0 && !bulkMutation.isPending;

  const handleApply = async () => {
    if (!canApply) return;
    try {
      const results = await bulkMutation.mutateAsync({
        deviceUuids: Array.from(selected),
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
    } catch {
      toast({ variant: 'destructive', title: 'Bulk error', description: 'Failed to apply app block changes.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/40 p-0 lg:p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl rounded-b-none animate-sheet-up pb-safe lg:animate-none lg:rounded-lg lg:pb-0 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 pt-5 pb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="rounded-md bg-blue-50 p-2">
              <AppWindow className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Bulk App Block</h2>
              <p className="text-xs text-muted-foreground">Block or unblock apps on multiple devices</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row flex-1 min-h-0 overflow-hidden">
          {/* Device selection */}
          <div className="flex flex-col sm:w-72 border-b sm:border-b-0 sm:border-r border-border max-h-56 sm:max-h-none">
            <div className="px-4 py-3 border-b border-border shrink-0 space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search devices…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-8 pr-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <button
                type="button"
                onClick={toggleAll}
                className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                {allSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                {allSelected ? 'Deselect all' : `Select all (${filtered.length})`}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-border">
              {filtered.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">No devices found</div>
              ) : (
                filtered.map((device) => {
                  const isSel = selected.has(device.deviceUuid);
                  return (
                    <button
                      key={device.deviceUuid}
                      type="button"
                      onClick={() => toggleOne(device.deviceUuid)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        isSel ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div
                        className={`shrink-0 h-4 w-4 rounded border-2 flex items-center justify-center transition-colors ${
                          isSel ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'
                        }`}
                      >
                        {isSel && <Check className="h-2.5 w-2.5 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {device.deviceName || 'Unnamed Device'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {device.userEmail || device.deviceUuid}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="px-4 py-2.5 border-t border-border bg-muted/30 shrink-0">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                <span>
                  <span className="font-semibold text-foreground">{selected.size}</span> device
                  {selected.size !== 1 ? 's' : ''} selected
                </span>
              </p>
            </div>
          </div>

          {/* Action + app picker */}
          <div className="flex flex-col flex-1 min-h-0">
            <div className="px-5 pt-4 pb-3 border-b border-border shrink-0 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode('block')}
                  className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    mode === 'block'
                      ? 'border-red-300 bg-red-50 text-red-700'
                      : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <ShieldOff className="h-4 w-4" /> Block apps
                </button>
                <button
                  type="button"
                  onClick={() => setMode('unblock')}
                  className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    mode === 'unblock'
                      ? 'border-green-300 bg-green-50 text-green-700'
                      : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Shield className="h-4 w-4" /> Unblock apps
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
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
            <div className="flex-1 overflow-y-auto divide-y divide-border">
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
                      className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors ${
                        isSel ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div
                        className={`shrink-0 h-4 w-4 rounded border-2 flex items-center justify-center transition-colors ${
                          isSel ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'
                        }`}
                      >
                        {isSel && <Check className="h-2.5 w-2.5 text-white" />}
                      </div>
                      <div className="shrink-0 h-8 w-8 rounded-md bg-blue-50 flex items-center justify-center overflow-hidden">
                        {iconSrc ? (
                          <img src={iconSrc} alt={app.appName} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-blue-600 font-semibold text-xs">
                            {(app.appName || '?').charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{app.appName || app.appPackageId}</p>
                        <p className="text-[11px] font-mono text-muted-foreground truncate">{app.appPackageId}</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-1.5">
                        {app.isSystemApp && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                            <Monitor className="h-3 w-3" />System
                          </span>
                        )}
                        <span className="inline-flex items-center rounded-md bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                          {app.deviceCount} device{app.deviceCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Manual fallback */}
            <div className="border-t border-border px-5 py-3 shrink-0 space-y-2">
              <button
                type="button"
                onClick={() => setShowManual((v) => !v)}
                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                <ChevronRight className={`h-3.5 w-3.5 transition-transform ${showManual ? 'rotate-90' : ''}`} />
                Add package id manually
              </button>
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
                      className="h-8 flex-1 rounded-md border border-gray-300 bg-white px-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={addPackages}
                      disabled={!packageInput.trim()}
                      className="inline-flex items-center gap-1 h-8 rounded-md border border-gray-300 px-2.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <Plus className="h-3 w-3" /> Add
                    </button>
                  </div>
                  {customPkgs.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {customPkgs.map((pkg) => (
                        <span key={pkg} className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-mono text-gray-700">
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
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-4 shrink-0">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{allPackageIds.length}</span> app{allPackageIds.length !== 1 ? 's' : ''} selected
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!canApply}
              className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
                mode === 'block' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {bulkMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {mode === 'block' ? 'Block' : 'Unblock'} {allPackageIds.length} app{allPackageIds.length !== 1 ? 's' : ''} on {selected.size} device{selected.size !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
