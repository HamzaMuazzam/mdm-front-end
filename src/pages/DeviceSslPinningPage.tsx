import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Trash2,
  Plus,
  Loader2,
  AlertTriangle,
  Copy,
} from 'lucide-react';
import { useDevicesQuery } from '@/hooks/useDevices';
import {
  useSslPinningPolicies,
  useSaveSslPinningPolicy,
  useToggleSslPinningPolicy,
  useDeleteSslPinningPolicy,
} from '@/hooks/useSslPinning';
import type { SslPinningPolicy } from '@/api/services/sslPinning.service';
import { ROUTES } from '@/utils/constants';
import { usePermissionStore } from '@/store/permissionStore';
import { BulkSslPinningModal } from '@/components/features/devices/BulkSslPinningModal';

function maskPin(pin: string): string {
  if (pin.length <= 16) return pin;
  return `${pin.slice(0, 12)}…${pin.slice(-6)}`;
}

export function DeviceSslPinningPage() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();
  const hasPermission = usePermissionStore((s) => s.hasPermission);
  const canManage = hasPermission('configuration:update');

  const numericId = deviceId ? parseInt(deviceId, 10) : null;
  const { data: devices = [], isLoading: devicesLoading } = useDevicesQuery();
  const device = devices.find((d) => d.id === numericId);
  const deviceUuid = device?.deviceUuid ?? null;

  const { data: policies = [], isLoading, isError } = useSslPinningPolicies(canManage ? deviceUuid : null);
  const saveMutation = useSaveSslPinningPolicy(deviceUuid);
  const toggleMutation = useToggleSslPinningPolicy(deviceUuid);
  const deleteMutation = useDeleteSslPinningPolicy(deviceUuid);
  const [isApplyMoreOpen, setIsApplyMoreOpen] = useState(false);

  const [domain, setDomain] = useState('');
  const [pin, setPin] = useState('');

  const byDomain = useMemo(() => {
    const m = new Map<string, SslPinningPolicy[]>();
    policies.forEach((p) => {
      const arr = m.get(p.targetDomain) ?? [];
      arr.push(p);
      m.set(p.targetDomain, arr);
    });
    return Array.from(m.entries());
  }, [policies]);

  const handleAdd = () => {
    if (!deviceUuid || !domain.trim() || !pin.trim()) return;
    saveMutation.mutate(
      { targetDomain: domain.trim(), pinValue: pin.trim(), isEnabled: true, deviceUuid },
      { onSuccess: () => { setDomain(''); setPin(''); } }
    );
  };

  if (devicesLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(ROUTES.DASHBOARD, { state: { activeTab: 'devices' } })}
            className="p-2 -ml-1 rounded-md hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="h-8 w-8 rounded-md bg-blue-50 flex items-center justify-center shrink-0">
            <Lock className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate text-sm leading-tight">
              {device?.deviceName ?? 'Unknown Device'}
            </p>
            <p className="text-[10px] text-gray-500 truncate">SSL Certificate Pinning</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-5">
        {!canManage ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <div className="h-14 w-14 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-gray-600">Access restricted</p>
            <p className="text-xs text-gray-500 max-w-xs">
              You do not have permission to manage SSL pinning for this device.
            </p>
          </div>
        ) : (
          <>
            {/* Add form */}
            <div className="rounded-lg border border-gray-200 bg-white p-4 mb-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-gray-500">ADD PINNED CERTIFICATE</p>
                {device && (
                  <button
                    type="button"
                    onClick={() => setIsApplyMoreOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
                    title="Assign this device's enabled pins to groups or other devices"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Apply to more devices…
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr,1.5fr,auto] gap-3">
                <input
                  type="text"
                  placeholder="api.bank.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <input
                  type="text"
                  placeholder="sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={saveMutation.isPending || !domain.trim() || !pin.trim()}
                  className="inline-flex items-center justify-center gap-1.5 h-9 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Add
                </button>
              </div>
              <p className="text-[11px] text-gray-400 mt-2">
                Add multiple pins per domain for safe rotation. Disabling all pins for a domain falls back to the system trust store.
              </p>
            </div>

            {/* List */}
            {isLoading && policies.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="h-7 w-7 animate-spin text-gray-400" />
                <p className="text-sm text-gray-500">Loading pinned certificates…</p>
              </div>
            )}

            {isError && (
              <div className="flex items-center gap-2.5 rounded-md bg-red-50 border border-red-200 px-4 py-3">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                <p className="text-sm text-red-700">Failed to load SSL pinning policies.</p>
              </div>
            )}

            {!isLoading && !isError && policies.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <div className="h-14 w-14 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400">
                  <Lock className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">No pinned certificates</p>
                  <p className="text-xs text-gray-500 mt-1 max-w-xs">
                    Add a domain and its SHA-256 pin above to enforce certificate pinning on this device.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {byDomain.map(([dom, rows]) => {
                const anyEnabled = rows.some((r) => r.isEnabled);
                return (
                  <div key={dom} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50/60">
                      <div className="flex items-center gap-2 min-w-0">
                        {anyEnabled ? (
                          <ShieldCheck className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <ShieldAlert className="h-4 w-4 text-gray-400" />
                        )}
                        <span className="text-sm font-medium text-gray-800 truncate">{dom}</span>
                      </div>
                      <span className={`text-[11px] font-medium ${anyEnabled ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {anyEnabled ? 'Pinned' : 'System trust'}
                      </span>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {rows.map((r) => (
                        <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                          <span className="flex-1 min-w-0 text-xs font-mono text-gray-600 truncate" title={r.pinValue}>
                            {maskPin(r.pinValue)}
                          </span>
                          <label className="relative inline-flex items-center cursor-pointer shrink-0">
                            <input
                              type="checkbox"
                              checked={r.isEnabled}
                              disabled={toggleMutation.isPending}
                              onChange={() => toggleMutation.mutate({ id: r.id, enabled: !r.isEnabled })}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                          <button
                            type="button"
                            onClick={() => deleteMutation.mutate(r.id)}
                            disabled={deleteMutation.isPending}
                            className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                            title="Delete pin"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
      {isApplyMoreOpen && device && (
        <BulkSslPinningModal
          devices={devices}
          lockedDeviceUuids={[device.deviceUuid]}
          initialEntries={policies
            .filter((p) => p.isEnabled && p.scope === 'DEVICE')
            .map((p) => ({ targetDomain: p.targetDomain, pinValue: p.pinValue, isEnabled: true }))}
          onClose={() => setIsApplyMoreOpen(false)}
        />
      )}
    </div>
  );
}
