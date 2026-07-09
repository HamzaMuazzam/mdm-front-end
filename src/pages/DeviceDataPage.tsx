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
  { id: 'contacts', label: 'Contacts', Icon: Users,         color: 'text-blue-700' },
  { id: 'sms',      label: 'Messages', Icon: MessageSquare, color: 'text-blue-700' },
  { id: 'calls',    label: 'Call Logs', Icon: Phone,        color: 'text-blue-700' },
];

const SYNC_OPTIONS: { type: SyncType; label: string; desc: string; color: string }[] = [
  { type: 'sync_contacts', label: 'Contacts',  desc: 'Phone book entries',  color: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100' },
  { type: 'sync_sms',      label: 'Messages',  desc: 'SMS inbox & sent',    color: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100' },
  { type: 'sync_calls',    label: 'Call Logs', desc: 'Incoming & outgoing', color: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100' },
  { type: 'sync_all',      label: 'Sync All',  desc: 'Everything at once',  color: 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700' },
];

function CallTypeIcon({ type }: { type: DeviceCallLog['callType'] }) {
  switch (type) {
    case 'INCOMING':  return <PhoneIncoming  className="h-4 w-4 text-green-600" />;
    case 'OUTGOING':  return <PhoneOutgoing  className="h-4 w-4 text-blue-600" />;
    case 'MISSED':    return <PhoneMissed    className="h-4 w-4 text-red-600" />;
    case 'REJECTED':  return <PhoneMissed    className="h-4 w-4 text-amber-600" />;
    default:          return <PhoneCall      className="h-4 w-4 text-gray-400" />;
  }
}

/* ─── stat card ──────────────────────────────────────────────────────────── */
function StatCard({ icon, label, value, sublabel, accent }: {
  icon: React.ReactNode; label: string; value: number; sublabel: string; accent: string;
}) {
  return (
      <div className={`flex-1 rounded-lg border ${accent} p-4 flex flex-col gap-1 min-w-0`}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-500 font-medium">{label}</span>
          {icon}
        </div>
        <p className="text-2xl font-semibold text-gray-900 tabular-nums leading-none">{value.toLocaleString()}</p>
        <p className="text-[11px] text-gray-500 leading-tight">{sublabel}</p>
      </div>
  );
}

/* ─── pagination ─────────────────────────────────────────────────────────── */
function Pagination({ page, totalPages, onPage }: {
  page: number; totalPages: number; onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
      <div className="flex items-center justify-center gap-3 py-4 border-t border-gray-100 mt-2">
        <button
            onClick={() => onPage(page - 1)}
            disabled={page === 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-white border border-gray-300 text-gray-600 text-xs disabled:opacity-30 hover:text-gray-900 hover:bg-gray-50 transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Prev
        </button>
        <span className="text-xs text-gray-500 tabular-nums">
        Page {page + 1} of {totalPages}
      </span>
        <button
            onClick={() => onPage(page + 1)}
            disabled={page >= totalPages - 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-white border border-gray-300 text-gray-600 text-xs disabled:opacity-30 hover:text-gray-900 hover:bg-gray-50 transition-colors"
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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder ?? 'Search…'}
            className="w-full h-9 pl-9 pr-9 rounded-md bg-white border border-gray-300 text-sm text-gray-900
                   placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary transition-all"
        />
        {value && (
            <button onClick={() => onChange('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
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
        <div className="h-14 w-14 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400">
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-xs text-gray-500 mt-1 max-w-xs">{description}</p>
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

  // Support both legacy device-data permissions and new granular permissions
  const canReadContacts = hasPermission('contacts:read') || hasPermission('device-data:read');
  const canReadSms      = hasPermission('sms:read')      || hasPermission('device-data:read');
  const canReadCalls    = hasPermission('call-logs:read') || hasPermission('device-data:read');
  const canSyncContacts = hasPermission('contacts:sync')  || hasPermission('device-data:sync');
  const canSyncSms      = hasPermission('sms:sync')       || hasPermission('device-data:sync');
  const canSyncCalls    = hasPermission('call-logs:sync') || hasPermission('device-data:sync');
  const canReadAny  = canReadContacts || canReadSms || canReadCalls;
  const canSyncAny  = canSyncContacts || canSyncSms || canSyncCalls;

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
    if (!deviceUuid || !canReadContacts) return;
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
  }, [deviceUuid, canReadContacts]);

  const loadSms = useCallback(async (page: number) => {
    if (!deviceUuid || !canReadSms) return;
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
  }, [deviceUuid, canReadSms]);

  const loadCalls = useCallback(async (page: number) => {
    if (!deviceUuid || !canReadCalls) return;
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
  }, [deviceUuid, canReadCalls]);

  useEffect(() => {
    if (!deviceUuid) return;
    loadStats();
    if (canReadContacts) loadContacts(0);
  }, [deviceUuid, loadStats, loadContacts, canReadContacts]);

  useEffect(() => {
    if (!deviceUuid) return;
    if (activeTab === 'sms'   && sms.length === 0   && canReadSms)   loadSms(0);
    if (activeTab === 'calls' && calls.length === 0 && canReadCalls) loadCalls(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, deviceUuid, canReadSms, canReadCalls]);

  // Auto-select first visible tab when permissions don't include contacts
  useEffect(() => {
    if (!canReadContacts && activeTab === 'contacts') {
      if (canReadSms)   setActiveTab('sms');
      else if (canReadCalls) setActiveTab('calls');
    }
  }, [canReadContacts, canReadSms, canReadCalls, activeTab]);

  function refreshCurrentTab() {
    setSearch('');
    setError(null);
    if (activeTab === 'contacts') loadContacts(contactsPage);
    if (activeTab === 'sms')      loadSms(smsPage);
    if (activeTab === 'calls')    loadCalls(callsPage);
    loadStats();
  }

  async function handleSync(type: SyncType) {
    if (!deviceUuid || !canSyncAny) return;
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

  const visibleTabs = TABS.filter((tab) =>
    (tab.id === 'contacts' && canReadContacts) ||
    (tab.id === 'sms'      && canReadSms)      ||
    (tab.id === 'calls'    && canReadCalls)
  );

  const visibleSyncOptions = SYNC_OPTIONS.filter(({ type }) =>
    (type === 'sync_contacts' && canSyncContacts) ||
    (type === 'sync_sms'      && canSyncSms)      ||
    (type === 'sync_calls'    && canSyncCalls)     ||
    (type === 'sync_all'      && canSyncAny)
  );

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
        <div className="flex h-screen items-center justify-center bg-gray-50">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
    );
  }

  return (
      <div className="min-h-screen bg-gray-50 text-gray-900">

        {/* ── sticky header ── */}
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
              <Database className="h-4 w-4 text-blue-600" />
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
                className="p-2 rounded-md hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700 disabled:opacity-40"
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
                <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${[canReadContacts, canReadSms, canReadCalls].filter(Boolean).length}, minmax(0, 1fr))` }}>
                  {canReadContacts && (
                    <StatCard
                        icon={<Users className="h-4 w-4 text-blue-600" />}
                        label="Contacts"
                        value={stats.contactCount}
                        sublabel="saved contacts"
                        accent="bg-white border-gray-200 shadow-sm"
                    />
                  )}
                  {canReadSms && (
                    <StatCard
                        icon={<MessageSquare className="h-4 w-4 text-blue-600" />}
                        label="Messages"
                        value={stats.smsCount}
                        sublabel="SMS records"
                        accent="bg-white border-gray-200 shadow-sm"
                    />
                  )}
                  {canReadCalls && (
                    <StatCard
                        icon={<Phone className="h-4 w-4 text-blue-600" />}
                        label="Call Logs"
                        value={stats.callLogCount}
                        sublabel="call records"
                        accent="bg-white border-gray-200 shadow-sm"
                    />
                  )}
                </div>
              </section>
          )}

          {/* ── sync section ── */}
          {canSyncAny && visibleSyncOptions.length > 0 && (
              <section className="rounded-lg bg-white border border-gray-200 shadow-sm overflow-hidden">
                {/* header */}
                <div className="px-5 pt-5 pb-4 border-b border-gray-200">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-md bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                      <Download className="h-4 w-4 text-blue-600" />
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
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-start gap-2.5">
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
                    {visibleSyncOptions.map(({ type, label, desc, color }) => (
                        <button
                            key={type}
                            type="button"
                            onClick={() => handleSync(type)}
                            disabled={!!syncing}
                            className={`flex flex-col items-center gap-2 p-4 rounded-md border text-center
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
                      <div className="mt-3 flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-4 py-2.5">
                        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                        <p className="text-sm text-green-700">
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
              <div className="flex items-center gap-2.5 rounded-md bg-red-50 border border-red-200 px-4 py-3">
                <X className="h-4 w-4 text-red-600 shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
                <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
          )}

          {/* ── data section ── */}
          {canReadAny ? (
              <section className="rounded-lg bg-white border border-gray-200 shadow-sm overflow-hidden">

                {/* tab bar */}
                <div className="border-b border-gray-200">
                  <div className="flex">
                    {visibleTabs.map((tab) => {
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
                                  ? `border-blue-600 ${tab.color}`
                                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                              }`}
                          >
                            <tab.Icon className="h-4 w-4 shrink-0" />
                            <span className="hidden xs:inline sm:inline">{tab.label}</span>
                            {count != null && count > 0 && (
                                <span className={`hidden sm:inline text-[10px] px-1.5 py-0.5 rounded-full
                                         ${activeTab === tab.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
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
                                   className="flex items-center gap-3 rounded-lg bg-white border border-gray-200 px-4 py-3
                                   hover:bg-gray-50 transition-colors">
                                <div className="h-10 w-10 rounded-full bg-blue-50 border border-blue-200
                                        flex items-center justify-center shrink-0">
                          <span className="text-sm font-semibold text-blue-600">
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
                                   className="rounded-lg bg-white border border-gray-200 px-4 py-3
                                   hover:bg-gray-50 transition-colors">
                                <div className="flex items-center justify-between mb-1.5 gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                            <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold
                                             ${s.smsType === 'INBOX'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-gray-100 text-gray-700 border border-gray-200'}`}>
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
                                   className="flex items-center gap-3 rounded-lg bg-white border border-gray-200 px-4 py-3
                                   hover:bg-gray-50 transition-colors">
                                <div className="h-10 w-10 rounded-full bg-gray-100 border border-gray-200
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
                                c.callType === 'INCOMING' ? 'text-green-600' :
                                    c.callType === 'OUTGOING' ? 'text-blue-600'    :
                                        c.callType === 'MISSED'   ? 'text-red-600'     :
                                            c.callType === 'REJECTED' ? 'text-amber-600'  : 'text-gray-500'
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
              <div className="rounded-lg bg-white border border-gray-200 shadow-sm py-16 text-center">
                <p className="text-sm text-slate-500">You do not have permission to view device data.</p>
              </div>
          )}
        </div>
      </div>
  );
}
