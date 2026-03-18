import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Phone,
  MessageSquare,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  RefreshCw,
  Users,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Download,
} from 'lucide-react';
import { useDevicesQuery } from '@/hooks/useDevices';
import {
  deviceDataService,
  type DeviceContact,
  type DeviceSms,
  type DeviceCallLog,
  type DeviceDataStats,
  type SyncType,
} from '@/api/services/deviceData.service';
import { ROUTES } from '@/utils/constants';
import { usePermissionStore } from '@/store/permissionStore';

/* ─── helpers ─────────────────────────────────────────────────────────────── */
function fmtTs(ts: number | string | null | undefined): string {
  if (!ts) return '—';
  const d = typeof ts === 'number' ? new Date(ts) : new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(d);
}

function fmtDuration(seconds: number): string {
  if (!seconds) return '0s';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/* ─── tab definition ─────────────────────────────────────────────────────── */
type Tab = 'contacts' | 'sms' | 'calls';

// Store component references (not JSX) to avoid module-level JSX that breaks react-refresh
const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: 'contacts', label: 'Contacts', Icon: Users },
  { id: 'sms',      label: 'SMS',      Icon: MessageSquare },
  { id: 'calls',    label: 'Calls',    Icon: Phone },
];

/* ─── sync button ─────────────────────────────────────────────────────────── */
const SYNC_BUTTONS: { type: SyncType; label: string }[] = [
  { type: 'sync_contacts', label: 'Contacts' },
  { type: 'sync_sms',      label: 'SMS' },
  { type: 'sync_calls',    label: 'Calls' },
  { type: 'sync_all',      label: 'All' },
];

/* ─── call type icon ──────────────────────────────────────────────────────── */
function CallTypeIcon({ type }: { type: DeviceCallLog['callType'] }) {
  switch (type) {
    case 'INCOMING':  return <PhoneIncoming  className="h-4 w-4 text-emerald-400" />;
    case 'OUTGOING':  return <PhoneOutgoing  className="h-4 w-4 text-blue-400" />;
    case 'MISSED':    return <PhoneMissed    className="h-4 w-4 text-red-400" />;
    case 'REJECTED':  return <PhoneMissed    className="h-4 w-4 text-orange-400" />;
    default:          return <PhoneCall      className="h-4 w-4 text-slate-500" />;
  }
}

/* ─── pagination bar ─────────────────────────────────────────────────────── */
function Pagination({
  page, totalPages, onPage,
}: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 py-3">
      <button
        onClick={() => onPage(page - 1)}
        disabled={page === 0}
        className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 disabled:opacity-30 hover:text-slate-100 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-xs text-slate-500">{page + 1} / {totalPages}</span>
      <button
        onClick={() => onPage(page + 1)}
        disabled={page >= totalPages - 1}
        className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 disabled:opacity-30 hover:text-slate-100 transition-colors"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ─── search bar ─────────────────────────────────────────────────────────── */
function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-600 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search…"
        className="w-full h-9 pl-8 pr-8 rounded-xl bg-slate-800/80 border border-slate-700/60 text-sm text-slate-100
                   placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors"
      />
      {value && (
        <button onClick={() => onChange('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
          <X className="h-3.5 w-3.5 text-slate-500 hover:text-slate-300" />
        </button>
      )}
    </div>
  );
}

/* ─── stat card ──────────────────────────────────────────────────────────── */
function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: number; color: string;
}) {
  return (
    <div className="flex-1 rounded-2xl bg-slate-900/70 border border-slate-800/60 p-4 flex flex-col gap-1">
      <div className={`${color} mb-1`}>{icon}</div>
      <p className="text-xl font-bold text-slate-100 tabular-nums">{value.toLocaleString()}</p>
      <p className="text-[10px] text-slate-600 uppercase tracking-wider">{label}</p>
    </div>
  );
}

/* ─── page ───────────────────────────────────────────────────────────────── */
export function DeviceDataPage() {
  const { deviceId }  = useParams<{ deviceId: string }>();
  const navigate      = useNavigate();
  const hasPermission = usePermissionStore((s) => s.hasPermission);

  const numericId = deviceId ? parseInt(deviceId, 10) : null;
  const { data: devices = [], isLoading } = useDevicesQuery();
  const device = devices.find((d) => d.id === numericId);

  // Stable primitive — won't change reference when React Query refetches
  const deviceUuid = device?.deviceUuid ?? null;

  const canRead = hasPermission('device-data:read');
  const canSync = hasPermission('device-data:sync');

  // ── state ──
  const [activeTab,   setActiveTab]   = useState<Tab>('contacts');
  const [stats,       setStats]       = useState<DeviceDataStats | null>(null);
  const [contacts,    setContacts]    = useState<DeviceContact[]>([]);
  const [sms,         setSms]         = useState<DeviceSms[]>([]);
  const [calls,       setCalls]       = useState<DeviceCallLog[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [syncing,     setSyncing]     = useState<SyncType | null>(null);
  const [search,      setSearch]      = useState('');
  const [error,       setError]       = useState<string | null>(null);

  // pagination per tab
  const [contactsPage,  setContactsPage]  = useState(0);
  const [smsPage,       setSmsPage]       = useState(0);
  const [callsPage,     setCallsPage]     = useState(0);
  const [contactsTotal, setContactsTotal] = useState(0);
  const [smsTotal,      setSmsTotal]      = useState(0);
  const [callsTotal,    setCallsTotal]    = useState(0);

  const PAGE_SIZE = 50;

  // ── loaders — deps use deviceUuid (string) not device (object) ──
  const loadStats = useCallback(async () => {
    if (!deviceUuid) return;
    try {
      const s = await deviceDataService.getStats(deviceUuid);
      setStats(s);
    } catch { /* ignore */ }
  }, [deviceUuid]);

  const loadContacts = useCallback(async (page: number) => {
    if (!deviceUuid || !canRead) return;
    setLoading(true);
    try {
      const p = await deviceDataService.getContacts(deviceUuid, page, PAGE_SIZE);
      setContacts(p.content);
      setContactsTotal(p.totalPages);
      setContactsPage(p.number);
    } catch {
      setError('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, [deviceUuid, canRead]);

  const loadSms = useCallback(async (page: number) => {
    if (!deviceUuid || !canRead) return;
    setLoading(true);
    try {
      const p = await deviceDataService.getSms(deviceUuid, page, PAGE_SIZE);
      setSms(p.content);
      setSmsTotal(p.totalPages);
      setSmsPage(p.number);
    } catch {
      setError('Failed to load SMS');
    } finally {
      setLoading(false);
    }
  }, [deviceUuid, canRead]);

  const loadCalls = useCallback(async (page: number) => {
    if (!deviceUuid || !canRead) return;
    setLoading(true);
    try {
      const p = await deviceDataService.getCalls(deviceUuid, page, PAGE_SIZE);
      setCalls(p.content);
      setCallsTotal(p.totalPages);
      setCallsPage(p.number);
    } catch {
      setError('Failed to load call logs');
    } finally {
      setLoading(false);
    }
  }, [deviceUuid, canRead]);

  // ── initial load — depends on deviceUuid (stable string), not device object ──
  useEffect(() => {
    if (!deviceUuid) return;
    loadStats();
    loadContacts(0);
  }, [deviceUuid, loadStats, loadContacts]);

  useEffect(() => {
    if (!deviceUuid || !canRead) return;
    if (activeTab === 'sms'   && sms.length === 0)  loadSms(0);
    if (activeTab === 'calls' && calls.length === 0) loadCalls(0);
  // loadSms/loadCalls are stable when deviceUuid doesn't change; sms/calls
  // lengths are intentionally not in deps (we only want this on tab switch)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, deviceUuid, canRead]);

  // ── refresh current tab ──
  function refreshCurrentTab() {
    setSearch('');
    if (activeTab === 'contacts') loadContacts(contactsPage);
    if (activeTab === 'sms')      loadSms(smsPage);
    if (activeTab === 'calls')    loadCalls(callsPage);
    loadStats();
  }

  // ── sync trigger ──
  async function handleSync(type: SyncType) {
    if (!deviceUuid || !canSync) return;
    setSyncing(type);
    setError(null);
    try {
      await deviceDataService.triggerSync(deviceUuid, type);
    } catch {
      setError('Failed to send sync command');
    } finally {
      setSyncing(null);
    }
  }

  // ── filtered data ──
  const q = search.toLowerCase();

  const filteredContacts = contacts.filter((c) =>
    !q || c.name.toLowerCase().includes(q) || c.phoneNumber.includes(q)
  );
  const filteredSms = sms.filter((s) =>
    !q || s.address.includes(q) || (s.body ?? '').toLowerCase().includes(q)
  );
  const filteredCalls = calls.filter((c) =>
    !q || c.phoneNumber.includes(q) || c.callType.toLowerCase().includes(q)
  );

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100">

      {/* ── header ── */}
      <div className="shrink-0 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 px-4 z-10">
        <div className="flex items-center gap-3 h-14">
          <button
            type="button"
            onClick={() => navigate(ROUTES.DASHBOARD, { state: { activeTab: 'devices' } })}
            className="p-2 -ml-2 rounded-xl hover:bg-slate-800 transition-colors text-slate-400 hover:text-slate-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-100 truncate text-sm leading-tight">
              {device?.deviceName ?? 'Unknown Device'}
            </p>
            <p className="text-[10px] text-slate-600 font-mono truncate">Contacts · SMS · Calls</p>
          </div>
          <button
            type="button"
            onClick={refreshCurrentTab}
            disabled={loading}
            className="p-2 rounded-xl hover:bg-slate-800 transition-colors text-slate-500 hover:text-slate-200 disabled:opacity-40"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── scrollable body ── */}
      <div className="flex-1 overflow-y-auto">

        {/* ── stats strip ── */}
        {stats && (
          <div className="px-4 pt-4 pb-2 flex gap-3">
            <StatCard icon={<Users className="h-4 w-4" />} label="Contacts" value={stats.contactCount} color="text-blue-400" />
            <StatCard icon={<MessageSquare className="h-4 w-4" />} label="SMS" value={stats.smsCount} color="text-violet-400" />
            <StatCard icon={<Phone className="h-4 w-4" />} label="Calls" value={stats.callLogCount} color="text-emerald-400" />
          </div>
        )}

        {/* ── sync controls ── */}
        {canSync && (
          <div className="px-4 pt-3 pb-1">
            <div className="rounded-2xl bg-slate-900/70 border border-slate-800/60 p-3">
              <p className="text-[10px] text-slate-600 uppercase tracking-widest mb-2.5">Request Sync</p>
              <div className="flex gap-2 flex-wrap">
                {SYNC_BUTTONS.map(({ type, label }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleSync(type)}
                    disabled={!!syncing}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold
                                transition-all disabled:opacity-50 border
                                ${type === 'sync_all'
                                  ? 'bg-blue-600/20 border-blue-700/50 text-blue-300 hover:bg-blue-600/30'
                                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
                  >
                    {syncing === type
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <Download className="h-3 w-3" />}
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── error ── */}
        {error && (
          <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl bg-red-950/60 border border-red-900/50 px-4 py-2.5">
            <X className="h-4 w-4 text-red-400 shrink-0" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* ── tabs ── */}
        <div className="px-4 pt-4">
          <div className="flex gap-1 bg-slate-900/70 border border-slate-800/60 rounded-2xl p-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => { setActiveTab(tab.id); setSearch(''); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium
                            transition-all ${activeTab === tab.id
                              ? 'bg-slate-700 text-slate-100'
                              : 'text-slate-500 hover:text-slate-300'}`}
              >
                <tab.Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── search ── */}
        {canRead && (
          <div className="px-4 pt-3">
            <SearchBar value={search} onChange={setSearch} />
          </div>
        )}

        {/* ── content ── */}
        <div className="px-4 pt-3 pb-6 space-y-2">

          {/* ── contacts ── */}
          {activeTab === 'contacts' && canRead && (
            <>
              {loading && contacts.length === 0 && (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
                </div>
              )}
              {!loading && filteredContacts.length === 0 && (
                <div className="text-center py-12 text-slate-600 text-sm">No contacts found</div>
              )}
              {filteredContacts.map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-2xl bg-slate-900/60 border border-slate-800/50 px-4 py-3">
                  <div className="h-9 w-9 rounded-full bg-blue-600/20 border border-blue-700/30 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-blue-400">{c.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-100 truncate">{c.name}</p>
                    <p className="text-xs text-slate-500 font-mono truncate">{c.normalizedPhone ?? c.phoneNumber}</p>
                  </div>
                </div>
              ))}
              {!search && <Pagination page={contactsPage} totalPages={contactsTotal} onPage={(p) => loadContacts(p)} />}
            </>
          )}

          {/* ── sms ── */}
          {activeTab === 'sms' && canRead && (
            <>
              {loading && sms.length === 0 && (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
                </div>
              )}
              {!loading && filteredSms.length === 0 && (
                <div className="text-center py-12 text-slate-600 text-sm">No messages found</div>
              )}
              {filteredSms.map((s) => (
                <div key={s.id} className="rounded-2xl bg-slate-900/60 border border-slate-800/50 px-4 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className={`h-1.5 w-1.5 rounded-full ${s.smsType === 'INBOX' ? 'bg-violet-400' : 'bg-blue-400'}`} />
                      <p className="text-sm font-semibold text-slate-200 font-mono">{s.address}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-medium ${s.smsType === 'INBOX' ? 'text-violet-400' : 'text-blue-400'}`}>
                        {s.smsType}
                      </span>
                      <p className="text-[10px] text-slate-600">{fmtTs(s.messageTimestamp)}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{s.body || '(empty)'}</p>
                </div>
              ))}
              {!search && <Pagination page={smsPage} totalPages={smsTotal} onPage={(p) => loadSms(p)} />}
            </>
          )}

          {/* ── calls ── */}
          {activeTab === 'calls' && canRead && (
            <>
              {loading && calls.length === 0 && (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
                </div>
              )}
              {!loading && filteredCalls.length === 0 && (
                <div className="text-center py-12 text-slate-600 text-sm">No call logs found</div>
              )}
              {filteredCalls.map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-2xl bg-slate-900/60 border border-slate-800/50 px-4 py-3">
                  <div className="h-9 w-9 rounded-full bg-slate-800 border border-slate-700/50 flex items-center justify-center shrink-0">
                    <CallTypeIcon type={c.callType} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-100 font-mono truncate">{c.phoneNumber}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-medium ${
                        c.callType === 'INCOMING'  ? 'text-emerald-400' :
                        c.callType === 'OUTGOING'  ? 'text-blue-400' :
                        c.callType === 'MISSED'    ? 'text-red-400' :
                        c.callType === 'REJECTED'  ? 'text-orange-400' : 'text-slate-500'
                      }`}>{c.callType}</span>
                      {c.duration > 0 && (
                        <span className="text-[10px] text-slate-600">{fmtDuration(c.duration)}</span>
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-600 shrink-0">{fmtTs(c.callTimestamp)}</p>
                </div>
              ))}
              {!search && <Pagination page={callsPage} totalPages={callsTotal} onPage={(p) => loadCalls(p)} />}
            </>
          )}

          {!canRead && (
            <div className="text-center py-16 text-slate-600 text-sm">
              You do not have permission to view device data
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
