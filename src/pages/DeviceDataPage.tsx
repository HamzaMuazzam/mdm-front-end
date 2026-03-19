import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Phone,
  MessageSquare,
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
  CheckCircle2,
  Info,
  PhoneCall,
  Database,
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

type Tab = 'contacts' | 'sms' | 'calls';

const TABS: { id: Tab; label: string; Icon: React.ElementType; color: string }[] = [
  { id: 'contacts', label: 'Contacts', Icon: Users,         color: 'text-blue-400' },
  { id: 'sms',      label: 'Messages', Icon: MessageSquare, color: 'text-violet-400' },
  { id: 'calls',    label: 'Call Logs', Icon: Phone,        color: 'text-emerald-400' },
];

const SYNC_OPTIONS: { type: SyncType; label: string; desc: string; color: string }[] = [
  { type: 'sync_contacts', label: 'Contacts',  desc: 'Phone book entries',  color: 'bg-blue-600/20 border-blue-600/40 text-blue-300 hover:bg-blue-600/30' },
  { type: 'sync_sms',      label: 'Messages',  desc: 'SMS inbox & sent',    color: 'bg-violet-600/20 border-violet-600/40 text-violet-300 hover:bg-violet-600/30' },
  { type: 'sync_calls',    label: 'Call Logs', desc: 'Incoming & outgoing', color: 'bg-emerald-600/20 border-emerald-600/40 text-emerald-300 hover:bg-emerald-600/30' },
  { type: 'sync_all',      label: 'Sync All',  desc: 'Everything at once',  color: 'bg-slate-700 border-slate-600 text-slate-100 hover:bg-slate-600' },
];

function CallTypeIcon({ type }: { type: DeviceCallLog['callType'] }) {
  switch (type) {
    case 'INCOMING':  return <PhoneIncoming  className="h-4 w-4 text-emerald-400" />;
    case 'OUTGOING':  return <PhoneOutgoing  className="h-4 w-4 text-blue-400" />;
    case 'MISSED':    return <PhoneMissed    className="h-4 w-4 text-red-400" />;
    case 'REJECTED':  return <PhoneMissed    className="h-4 w-4 text-orange-400" />;
    default:          return <PhoneCall      className="h-4 w-4 text-slate-500" />;
  }
}

/* ─── stat card ──────────────────────────────────────────────────────────── */
function StatCard({ icon, label, value, sublabel, accent }: {
  icon: React.ReactNode; label: string; value: number; sublabel: string; accent: string;
}) {
  return (
      <div className={`flex-1 rounded-xl border ${accent} p-4 flex flex-col gap-1 min-w-0`}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-400 font-medium">{label}</span>
          {icon}
        </div>
        <p className="text-2xl font-bold text-slate-100 tabular-nums leading-none">{value.toLocaleString()}</p>
        <p className="text-[11px] text-slate-500 leading-tight">{sublabel}</p>
      </div>
  );
}

/* ─── pagination ─────────────────────────────────────────────────────────── */
function Pagination({ page, totalPages, onPage }: {
  page: number; totalPages: number; onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
      <div className="flex items-center justify-center gap-3 py-4 border-t border-slate-800/60 mt-2">
        <button
            onClick={() => onPage(page - 1)}
            disabled={page === 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 text-xs disabled:opacity-30 hover:text-slate-100 hover:bg-slate-700 transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Prev
        </button>
        <span className="text-xs text-slate-500 tabular-nums">
        Page {page + 1} of {totalPages}
      </span>
        <button
            onClick={() => onPage(page + 1)}
            disabled={page >= totalPages - 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 text-xs disabled:opacity-30 hover:text-slate-100 hover:bg-slate-700 transition-colors"
        >
          Next <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
  );
}

/* ─── search bar ─────────────────────────────────────────────────────────── */
function SearchBar({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder ?? 'Search…'}
            className="w-full h-10 pl-9 pr-9 rounded-xl bg-slate-800/80 border border-slate-700/60 text-sm text-slate-100
                   placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500 transition-all"
        />
        {value && (
            <button onClick={() => onChange('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-4 w-4 text-slate-500 hover:text-slate-300" />
            </button>
        )}
      </div>
  );
}

/* ─── empty state ─────────────────────────────────────────────────────────── */
function EmptyState({ icon, title, description }: {
  icon: React.ReactNode; title: string; description: string;
}) {
  return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <div className="h-14 w-14 rounded-full bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-slate-600">
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-slate-400">{title}</p>
          <p className="text-xs text-slate-600 mt-1 max-w-xs">{description}</p>
        </div>
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
  const deviceUuid = device?.deviceUuid ?? null;

  const canRead = hasPermission('device-data:read');
  const canSync = hasPermission('device-data:sync');

  const [activeTab,   setActiveTab]   = useState<Tab>('contacts');
  const [stats,       setStats]       = useState<DeviceDataStats | null>(null);
  const [contacts,    setContacts]    = useState<DeviceContact[]>([]);
  const [sms,         setSms]         = useState<DeviceSms[]>([]);
  const [calls,       setCalls]       = useState<DeviceCallLog[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [syncing,     setSyncing]     = useState<SyncType | null>(null);
  const [syncDone,    setSyncDone]    = useState<SyncType | null>(null);
  const [search,      setSearch]      = useState('');
  const [error,       setError]       = useState<string | null>(null);

  const [contactsPage,  setContactsPage]  = useState(0);
  const [smsPage,       setSmsPage]       = useState(0);
  const [callsPage,     setCallsPage]     = useState(0);
  const [contactsTotal, setContactsTotal] = useState(0);
  const [smsTotal,      setSmsTotal]      = useState(0);
  const [callsTotal,    setCallsTotal]    = useState(0);

  const PAGE_SIZE = 50;

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
      setError('Failed to load messages');
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

  useEffect(() => {
    if (!deviceUuid) return;
    loadStats();
    loadContacts(0);
  }, [deviceUuid, loadStats, loadContacts]);

  useEffect(() => {
    if (!deviceUuid || !canRead) return;
    if (activeTab === 'sms'   && sms.length === 0)  loadSms(0);
    if (activeTab === 'calls' && calls.length === 0) loadCalls(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, deviceUuid, canRead]);

  function refreshCurrentTab() {
    setSearch('');
    setError(null);
    if (activeTab === 'contacts') loadContacts(contactsPage);
    if (activeTab === 'sms')      loadSms(smsPage);
    if (activeTab === 'calls')    loadCalls(callsPage);
    loadStats();
  }

  async function handleSync(type: SyncType) {
    if (!deviceUuid || !canSync) return;
    setSyncing(type);
    setSyncDone(null);
    setError(null);
    try {
      await deviceDataService.triggerSync(deviceUuid, type);
      setSyncDone(type);
      setTimeout(() => setSyncDone(null), 4000);
    } catch {
      setError('Could not send sync request to device. Make sure the device is online.');
    } finally {
      setSyncing(null);
    }
  }

  const q = search.toLowerCase();
  const filteredContacts = contacts.filter((c) =>
      !q || c.name.toLowerCase().includes(q) || c.phoneNumber.includes(q)
  );
  const filteredSms = sms.filter((s) =>
      !q || s.address.includes(q) || (s.body ?? '').toLowerCase().includes(q)
  );
  const filteredCalls = calls.filter((c) =>
      !q || c.phoneNumber.includes(q) || c.callType.toLowerCase().includes(q) || (c.name ?? '').toLowerCase().includes(q)
  );

  if (isLoading) {
    return (
        <div className="flex h-screen items-center justify-center bg-slate-950">
          <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
        </div>
    );
  }

  return (
      <div className="min-h-screen bg-slate-950 text-slate-100">

        {/* ── sticky header ── */}
        <div className="sticky top-0 z-20 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
          <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
            <button
                type="button"
                onClick={() => navigate(ROUTES.DASHBOARD, { state: { activeTab: 'devices' } })}
                className="p-2 -ml-1 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-slate-100"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <div className="h-8 w-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
              <Database className="h-4 w-4 text-slate-400" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-100 truncate text-sm leading-tight">
                {device?.deviceName ?? 'Unknown Device'}
              </p>
              <p className="text-[10px] text-slate-500 truncate">Device Data Monitor</p>
            </div>

            <button
                type="button"
                onClick={refreshCurrentTab}
                disabled={loading}
                title="Refresh current data"
                className="p-2 rounded-lg hover:bg-slate-800 transition-colors text-slate-500 hover:text-slate-200 disabled:opacity-40"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* ── main content ── */}
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">

          {/* ── stats ── */}
          {stats && (
              <section>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Stored on Dashboard
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <StatCard
                      icon={<Users className="h-4 w-4 text-blue-400" />}
                      label="Contacts"
                      value={stats.contactCount}
                      sublabel="saved contacts"
                      accent="bg-blue-950/30 border-blue-900/40"
                  />
                  <StatCard
                      icon={<MessageSquare className="h-4 w-4 text-violet-400" />}
                      label="Messages"
                      value={stats.smsCount}
                      sublabel="SMS records"
                      accent="bg-violet-950/30 border-violet-900/40"
                  />
                  <StatCard
                      icon={<Phone className="h-4 w-4 text-emerald-400" />}
                      label="Call Logs"
                      value={stats.callLogCount}
                      sublabel="call records"
                      accent="bg-emerald-950/30 border-emerald-900/40"
                  />
                </div>
              </section>
          )}

          {/* ── sync section ── */}
          {canSync && (
              <section className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
                {/* header */}
                <div className="px-5 pt-5 pb-4 border-b border-slate-800">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Download className="h-4 w-4 text-slate-300" />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-sm font-semibold text-slate-100">Request Data Sync</h2>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                        Send a request to the device to upload its latest data to this dashboard.
                        The device must be online for this to work.
                      </p>
                    </div>
                  </div>
                </div>

                {/* info banner */}
                <div className="px-5 py-3 bg-slate-800/40 border-b border-slate-800 flex items-start gap-2.5">
                  <Info className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-500 leading-relaxed">
                    <span className="text-slate-400 font-medium">How it works: </span>
                    When you press a button below, the dashboard sends a message to the device asking it to
                    share its data. The device then uploads contacts, messages, or call history to this dashboard.
                    New data will appear here after a few seconds — press the refresh button to check.
                  </p>
                </div>

                {/* sync buttons */}
                <div className="p-5">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {SYNC_OPTIONS.map(({ type, label, desc, color }) => (
                        <button
                            key={type}
                            type="button"
                            onClick={() => handleSync(type)}
                            disabled={!!syncing}
                            className={`flex flex-col items-center gap-2 p-4 rounded-xl border text-center
                                transition-all disabled:opacity-50 cursor-pointer ${color}`}
                        >
                          {syncing === type ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                          ) : syncDone === type ? (
                              <CheckCircle2 className="h-5 w-5 text-green-400" />
                          ) : (
                              <Download className="h-5 w-5" />
                          )}
                          <div>
                            <p className="text-sm font-semibold leading-tight">{label}</p>
                            <p className="text-[11px] opacity-70 mt-0.5 leading-tight">{desc}</p>
                          </div>
                        </button>
                    ))}
                  </div>

                  {/* sync feedback */}
                  {syncDone && (
                      <div className="mt-3 flex items-center gap-2 rounded-xl bg-green-950/50 border border-green-900/50 px-4 py-2.5">
                        <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                        <p className="text-sm text-green-300">
                          Sync request sent! The device will upload its data shortly.
                          Press the refresh button above to see new data.
                        </p>
                      </div>
                  )}
                </div>
              </section>
          )}

          {/* ── error ── */}
          {error && (
              <div className="flex items-center gap-2.5 rounded-xl bg-red-950/50 border border-red-900/50 px-4 py-3">
                <X className="h-4 w-4 text-red-400 shrink-0" />
                <p className="text-sm text-red-300">{error}</p>
                <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-300">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
          )}

          {/* ── data section ── */}
          {canRead ? (
              <section className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">

                {/* tab bar */}
                <div className="border-b border-slate-800">
                  <div className="flex">
                    {TABS.map((tab) => {
                      const count = tab.id === 'contacts' ? stats?.contactCount
                          : tab.id === 'sms'      ? stats?.smsCount
                              : stats?.callLogCount;
                      return (
                          <button
                              key={tab.id}
                              type="button"
                              onClick={() => { setActiveTab(tab.id); setSearch(''); }}
                              className={`flex-1 flex items-center justify-center gap-2 py-3.5 px-2 text-sm font-medium
                                  border-b-2 transition-all
                                  ${activeTab === tab.id
                                  ? `border-slate-400 ${tab.color}`
                                  : 'border-transparent text-slate-500 hover:text-slate-400 hover:border-slate-700'
                              }`}
                          >
                            <tab.Icon className="h-4 w-4 shrink-0" />
                            <span className="hidden xs:inline sm:inline">{tab.label}</span>
                            {count != null && count > 0 && (
                                <span className={`hidden sm:inline text-[10px] px-1.5 py-0.5 rounded-full
                                         ${activeTab === tab.id ? 'bg-slate-700 text-slate-300' : 'bg-slate-800 text-slate-500'}`}>
                          {count > 9999 ? '9999+' : count.toLocaleString()}
                        </span>
                            )}
                          </button>
                      );
                    })}
                  </div>
                </div>

                {/* search */}
                <div className="px-4 pt-4 pb-2">
                  <SearchBar
                      value={search}
                      onChange={setSearch}
                      placeholder={
                        activeTab === 'contacts' ? 'Search by name or phone number…' :
                            activeTab === 'sms'      ? 'Search by number or message content…' :
                                'Search by phone number or call type…'
                      }
                  />
                </div>

                {/* data list */}
                <div className="px-4 pb-4">

                  {/* contacts */}
                  {activeTab === 'contacts' && (
                      <>
                        {loading && contacts.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-16 gap-3">
                              <Loader2 className="h-7 w-7 animate-spin text-slate-600" />
                              <p className="text-sm text-slate-600">Loading contacts…</p>
                            </div>
                        )}
                        {!loading && filteredContacts.length === 0 && (
                            <EmptyState
                                icon={<Users className="h-6 w-6" />}
                                title={search ? 'No contacts match your search' : 'No contacts yet'}
                                description={search
                                    ? 'Try a different name or phone number.'
                                    : 'Use the "Request Data Sync" section above to fetch contacts from the device.'}
                            />
                        )}
                        <div className="space-y-2 mt-2">
                          {filteredContacts.map((c) => (
                              <div key={c.id}
                                   className="flex items-center gap-3 rounded-xl bg-slate-800/50 border border-slate-700/40 px-4 py-3
                                   hover:bg-slate-800/80 transition-colors">
                                <div className="h-10 w-10 rounded-full bg-blue-600/20 border border-blue-700/30
                                        flex items-center justify-center shrink-0">
                          <span className="text-sm font-bold text-blue-400">
                            {c.name.charAt(0).toUpperCase()}
                          </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-slate-100 truncate">{c.name}</p>
                                  <p className="text-xs text-slate-500 font-mono truncate mt-0.5">
                                    {c.normalizedPhone ?? c.phoneNumber}
                                  </p>
                                </div>
                              </div>
                          ))}
                        </div>
                        {!search && (
                            <Pagination page={contactsPage} totalPages={contactsTotal} onPage={loadContacts} />
                        )}
                      </>
                  )}

                  {/* sms */}
                  {activeTab === 'sms' && (
                      <>
                        {loading && sms.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-16 gap-3">
                              <Loader2 className="h-7 w-7 animate-spin text-slate-600" />
                              <p className="text-sm text-slate-600">Loading messages…</p>
                            </div>
                        )}
                        {!loading && filteredSms.length === 0 && (
                            <EmptyState
                                icon={<MessageSquare className="h-6 w-6" />}
                                title={search ? 'No messages match your search' : 'No messages yet'}
                                description={search
                                    ? 'Try a different search term.'
                                    : 'Use "Request Data Sync" above to fetch SMS messages from the device.'}
                            />
                        )}
                        <div className="space-y-2 mt-2">
                          {filteredSms.map((s) => (
                              <div key={s.id}
                                   className="rounded-xl bg-slate-800/50 border border-slate-700/40 px-4 py-3
                                   hover:bg-slate-800/80 transition-colors">
                                <div className="flex items-center justify-between mb-1.5 gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                            <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold
                                             ${s.smsType === 'INBOX'
                                ? 'bg-violet-900/50 text-violet-300 border border-violet-800/50'
                                : 'bg-blue-900/50 text-blue-300 border border-blue-800/50'}`}>
                              {s.smsType === 'INBOX' ? 'Received' : 'Sent'}
                            </span>
                                    <p className="text-sm font-semibold text-slate-200 font-mono truncate">{s.address}</p>
                                  </div>
                                  <p className="text-[11px] text-slate-500 shrink-0">{fmtTs(s.messageTimestamp)}</p>
                                </div>
                                <p className="text-xs text-slate-400 leading-relaxed line-clamp-2 pl-0.5">
                                  {s.body || <span className="italic text-slate-600">(empty message)</span>}
                                </p>
                              </div>
                          ))}
                        </div>
                        {!search && <Pagination page={smsPage} totalPages={smsTotal} onPage={loadSms} />}
                      </>
                  )}

                  {/* calls */}
                  {activeTab === 'calls' && (
                      <>
                        {loading && calls.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-16 gap-3">
                              <Loader2 className="h-7 w-7 animate-spin text-slate-600" />
                              <p className="text-sm text-slate-600">Loading call logs…</p>
                            </div>
                        )}
                        {!loading && filteredCalls.length === 0 && (
                            <EmptyState
                                icon={<Phone className="h-6 w-6" />}
                                title={search ? 'No call logs match your search' : 'No call logs yet'}
                                description={search
                                    ? 'Try a different phone number or call type.'
                                    : 'Use "Request Data Sync" above to fetch call history from the device.'}
                            />
                        )}
                        <div className="space-y-2 mt-2">
                          {filteredCalls.map((c) => (
                              <div key={c.id}
                                   className="flex items-center gap-3 rounded-xl bg-slate-800/50 border border-slate-700/40 px-4 py-3
                                   hover:bg-slate-800/80 transition-colors">
                                <div className="h-10 w-10 rounded-full bg-slate-700/60 border border-slate-600/40
                                        flex items-center justify-center shrink-0">
                                  <CallTypeIcon type={c.callType} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  {c.name && (
                                    <p className="text-sm font-semibold text-slate-100 truncate">{c.name}</p>
                                  )}
                                  <p className={`font-mono truncate ${c.name ? 'text-xs text-slate-500 mt-0' : 'text-sm font-semibold text-slate-100'}`}>{c.phoneNumber}</p>
                                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className={`text-[11px] font-medium ${
                                c.callType === 'INCOMING' ? 'text-emerald-400' :
                                    c.callType === 'OUTGOING' ? 'text-blue-400'    :
                                        c.callType === 'MISSED'   ? 'text-red-400'     :
                                            c.callType === 'REJECTED' ? 'text-orange-400'  : 'text-slate-500'
                            }`}>
                              {c.callType.charAt(0) + c.callType.slice(1).toLowerCase()}
                            </span>
                                    {c.duration > 0 && (
                                        <span className="text-[11px] text-slate-500">{fmtDuration(c.duration)}</span>
                                    )}
                                  </div>
                                </div>
                                <p className="text-[11px] text-slate-500 shrink-0 text-right leading-relaxed">
                                  {fmtTs(c.callTimestamp)}
                                </p>
                              </div>
                          ))}
                        </div>
                        {!search && <Pagination page={callsPage} totalPages={callsTotal} onPage={loadCalls} />}
                      </>
                  )}
                </div>
              </section>
          ) : (
              <div className="rounded-2xl bg-slate-900 border border-slate-800 py-16 text-center">
                <p className="text-sm text-slate-500">You do not have permission to view device data.</p>
              </div>
          )}
        </div>
      </div>
  );
}
