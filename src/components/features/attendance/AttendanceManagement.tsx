import { useState } from 'react';
import { Users, CalendarClock, ClipboardList, Palmtree, FileBarChart, Activity, Download, Loader2, ShieldAlert, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePermissionStore } from '@/store/permissionStore';
import { attendanceService } from '@/api/services/attendance.service';
import { useAttendanceEventsQuery, useAttendanceSummaryQuery, useLiveBoardQuery, useMonthlyReportQuery } from '@/hooks/useAttendance';
import { formatDuration } from '@/types/attendance.types';
import { EmptyState, Field, StatusBadge, fmtDateTime, fmtTime, selectClass, todayIso } from './shared';
import { EmployeesPanel } from './EmployeesPanel';
import { RostersPanel } from './RostersPanel';
import { RecordsPanel } from './RecordsPanel';
import { LeaveHolidayPanel } from './LeaveHolidayPanel';

type SubTab = 'overview' | 'records' | 'rosters' | 'employees' | 'leave' | 'reports';

function Tile({ label, value, tone = 'default' }: { label: string; value: number | string; tone?: 'default' | 'green' | 'amber' | 'red' | 'blue' }) {
  const tones = { default: 'text-gray-900', green: 'text-green-700', amber: 'text-amber-700', red: 'text-red-700', blue: 'text-blue-700' };
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tones[tone]}`}>{value}</div>
    </div>
  );
}

function LiveDuration({ record }: { record: { checkInAt?: string | null; totalDutySeconds: number } }) {
  return <span className="font-mono">{formatDuration(record.totalDutySeconds)}</span>;
}

function OverviewPanel() {
  const { data: summary, isLoading, refetch } = useAttendanceSummaryQuery();
  const { data: live = [] } = useLiveBoardQuery();
  const { data: violations = [] } = useAttendanceEventsQuery({ from: todayIso(), to: todayIso(), violationsOnly: true });
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Today · {summary?.date ?? todayIso()}</p>
        <Button variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw className="mr-1 h-3.5 w-3.5" />Refresh</Button>
      </div>
      {isLoading || !summary ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div> : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          <Tile label="On duty now" value={summary.onDutyNow} tone="green" />
          <Tile label="Checked in" value={summary.checkedIn} />
          <Tile label="Present" value={summary.present} tone="green" />
          <Tile label="Late" value={summary.late} tone="amber" />
          <Tile label="Absent" value={summary.absent} tone="red" />
          <Tile label="On leave" value={summary.onLeave} tone="blue" />
          <Tile label="Violations" value={summary.violationsToday} tone={summary.violationsToday > 0 ? 'red' : 'default'} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900"><Activity className="h-4 w-4 text-green-600" />On duty now</h3>
          {live.length === 0 ? <EmptyState text="Nobody is on duty right now." /> : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-4 py-2">Employee</th><th className="px-4 py-2">Roster</th><th className="px-4 py-2">Since</th><th className="px-4 py-2 text-right">Duty</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {live.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-2"><div className="font-medium text-gray-900">{r.employeeName ?? r.deviceName}</div><div className="text-xs text-muted-foreground">{r.employeeCode ?? r.deviceUuid}</div></td>
                      <td className="px-4 py-2 text-gray-600">{r.rosterName ?? '—'}</td>
                      <td className="px-4 py-2">{fmtTime(r.checkInAt)} <StatusBadge status={r.status} /></td>
                      <td className="px-4 py-2 text-right"><LiveDuration record={r} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900"><ShieldAlert className="h-4 w-4 text-red-600" />Violations today</h3>
          {violations.length === 0 ? <EmptyState text="No GPS-off, mock-location or liveness violations today." /> : (
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white text-sm">
              {violations.map((e) => (
                <li key={e.id} className="flex items-start gap-3 px-4 py-2">
                  <span className="w-28 shrink-0 font-mono text-xs text-muted-foreground">{fmtDateTime(e.occurredAt)}</span>
                  <span className="rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700">{e.type}</span>
                  <span className="text-gray-700">{e.deviceName}{e.details && <span className="text-muted-foreground"> — {e.details}</span>}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function ReportsPanel() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [downloading, setDownloading] = useState<string | null>(null);
  const { data: rows = [], isLoading } = useMonthlyReportQuery(year, month);

  const download = async (type: 'daily' | 'monthly' | 'violations') => {
    setDownloading(type);
    try {
      await attendanceService.downloadCsv(type, type === 'monthly' ? { year, month } : { from, to });
    } finally { setDownloading(null); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <Field label="Month"><select className={selectClass} value={month} onChange={(e) => setMonth(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2000, i, 1).toLocaleString([], { month: 'long' })}</option>)}</select></Field>
        <Field label="Year"><Input type="number" className="w-28" value={year} onChange={(e) => setYear(Number(e.target.value))} /></Field>
        <Button variant="outline" onClick={() => download('monthly')} disabled={downloading != null}>{downloading === 'monthly' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Monthly CSV</Button>
        <div className="mx-2 hidden h-8 w-px bg-gray-200 sm:block" />
        <Field label="From"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="To"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Button variant="outline" onClick={() => download('daily')} disabled={downloading != null}>{downloading === 'daily' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Daily sheet CSV</Button>
        <Button variant="outline" onClick={() => download('violations')} disabled={downloading != null}>{downloading === 'violations' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Violations CSV</Button>
      </div>

      {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : rows.length === 0 ? <EmptyState text="No data for this month." /> : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr><th className="px-3 py-3">Employee</th><th className="px-3 py-3 text-right">Days</th><th className="px-3 py-3 text-right">Present</th><th className="px-3 py-3 text-right">Late</th><th className="px-3 py-3 text-right">Absent</th><th className="px-3 py-3 text-right">Early</th><th className="px-3 py-3 text-right">Leave</th><th className="px-3 py-3 text-right">Duty</th><th className="px-3 py-3 text-right">OT</th><th className="px-3 py-3 text-right">Violations</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.employeeId} className="hover:bg-gray-50">
                    <td className="px-3 py-2"><div className="font-medium text-gray-900">{r.employeeName}</div><div className="text-xs text-muted-foreground">{r.employeeCode} · {r.deviceName ?? 'no device'}</div></td>
                    <td className="px-3 py-2 text-right">{r.scheduledDays}</td>
                    <td className="px-3 py-2 text-right text-green-700">{r.present}</td>
                    <td className="px-3 py-2 text-right text-amber-700">{r.late}</td>
                    <td className="px-3 py-2 text-right text-red-700">{r.absent}</td>
                    <td className="px-3 py-2 text-right">{r.earlyLeave}</td>
                    <td className="px-3 py-2 text-right text-blue-700">{r.onLeave}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatDuration(r.totalDutySeconds)}</td>
                    <td className="px-3 py-2 text-right">{formatDuration(r.overtimeSeconds)}</td>
                    <td className={`px-3 py-2 text-right ${r.violations > 0 ? 'text-red-700 font-medium' : ''}`}>{r.violations}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}

export function AttendanceManagement() {
  const hasPermission = usePermissionStore((s) => s.hasPermission);
  const tabs: { key: SubTab; label: string; icon: typeof Users; visible: boolean }[] = [
    { key: 'overview', label: 'Overview', icon: Activity, visible: hasPermission('attendance:records:read') },
    { key: 'records', label: 'Records', icon: ClipboardList, visible: hasPermission('attendance:records:read') },
    { key: 'rosters', label: 'Rosters & Sites', icon: CalendarClock, visible: hasPermission('attendance:rosters:read') },
    { key: 'employees', label: 'Employees', icon: Users, visible: hasPermission('attendance:records:read') },
    { key: 'leave', label: 'Leave & Holidays', icon: Palmtree, visible: hasPermission('attendance:records:read') },
    { key: 'reports', label: 'Reports', icon: FileBarChart, visible: hasPermission('attendance:reports') },
  ];
  const visible = tabs.filter((t) => t.visible);
  const [tab, setTab] = useState<SubTab>(visible[0]?.key ?? 'overview');

  if (visible.length === 0) return <EmptyState text="You do not have attendance permissions." />;

  return (
    <div className="space-y-5">
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-1 rounded-lg bg-gray-100 p-1">
          {visible.map(({ key, label, icon: Icon }) => (
            <button key={key} type="button" onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition ${tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
              <Icon className="h-4 w-4" />{label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'overview' && <OverviewPanel />}
      {tab === 'records' && <RecordsPanel />}
      {tab === 'rosters' && <RostersPanel />}
      {tab === 'employees' && <EmployeesPanel />}
      {tab === 'leave' && <LeaveHolidayPanel />}
      {tab === 'reports' && <ReportsPanel />}
    </div>
  );
}
