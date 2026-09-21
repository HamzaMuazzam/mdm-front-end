import { useEffect, useRef, useState } from 'react';
import { Brush, KeyRound, Square, Trash2, ChevronDown, Wrench } from 'lucide-react';
import { usePermissionStore } from '@/store/permissionStore';
import { APP_CONTROL_ACTION_LABELS, APP_CONTROL_PERMISSIONS, type AppControlAction } from '@/types/appControl.types';

const ITEMS: { key: AppControlAction; icon: typeof Brush; danger?: boolean }[] = [
  { key: 'CLEAR_CACHE', icon: Brush },
  { key: 'SET_PERMISSIONS', icon: KeyRound },
  { key: 'FORCE_STOP', icon: Square },
  { key: 'CLEAR_DATA', icon: Trash2, danger: true },
];

/** Small "Actions ▾" dropdown for one app row / the multi-select bar. Renders nothing without app-control:execute. */
export function AppRowActionsMenu({ onPick, label = 'Actions', align = 'right', solid = false }: {
  onPick: (action: AppControlAction) => void;
  label?: string;
  align?: 'left' | 'right';
  solid?: boolean;
}) {
  const hasPermission = usePermissionStore((s) => s.hasPermission);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  if (!hasPermission(APP_CONTROL_PERMISSIONS.execute)) return null;
  const canClearData = hasPermission(APP_CONTROL_PERMISSIONS.clearData);

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors ${
          solid ? 'bg-blue-600 text-white hover:bg-blue-700' : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
        }`}
      >
        <Wrench className="h-3.5 w-3.5" /> {label} <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className={`absolute z-40 mt-1 w-44 overflow-hidden rounded-md border border-gray-200 bg-white py-1 shadow-lg ${align === 'right' ? 'right-0' : 'left-0'}`}>
          {ITEMS.filter((i) => i.key !== 'CLEAR_DATA' || canClearData).map(({ key, icon: Icon, danger }) => (
            <button
              key={key}
              type="button"
              onClick={() => { setOpen(false); onPick(key); }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-gray-50 ${danger ? 'text-red-700' : 'text-gray-700'}`}
            >
              <Icon className="h-3.5 w-3.5" /> {APP_CONTROL_ACTION_LABELS[key]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
