import type { ReactNode } from 'react';
import { X, CalendarClock } from 'lucide-react';
import { ATTENDANCE_STATUS_CLASSES, ATTENDANCE_STATUS_LABELS, type AttendanceStatus } from '@/types/attendance.types';

/** Bottom-sheet on mobile, centred dialog on desktop — same shell as Device Groups. */
export function AttModal({
  title, subtitle, icon: Icon = CalendarClock, onClose, children, footer, widthClass = 'max-w-lg',
}: {
  title: string; subtitle?: string; icon?: typeof CalendarClock; onClose: () => void;
  children: ReactNode; footer?: ReactNode; widthClass?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className={`flex max-h-[92vh] w-full ${widthClass} flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl animate-sheet-up pb-safe sm:animate-none sm:rounded-lg sm:pb-0`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 pb-4 pt-5">
          <div className="flex items-center gap-2.5">
            <div className="rounded-md bg-blue-50 p-2"><Icon className="h-4 w-4 text-blue-600" /></div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">{title}</h2>
              {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: AttendanceStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${ATTENDANCE_STATUS_CLASSES[status] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
      {ATTENDANCE_STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-gray-700">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

export const todayIso = () => new Date().toISOString().slice(0, 10);

export function fmtDateTime(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

export function fmtTime(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Local datetime-input value ("YYYY-MM-DDTHH:mm") from a server LocalDateTime string. */
export function toInputDateTime(v?: string | null): string {
  if (!v) return '';
  return v.length >= 16 ? v.slice(0, 16) : v;
}

export function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center text-sm text-muted-foreground">{text}</div>;
}
