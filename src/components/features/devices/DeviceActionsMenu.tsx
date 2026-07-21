import { useEffect, useRef, useState, type ComponentType } from 'react';
import { MoreVertical, ChevronDown, ChevronRight, ArrowLeft, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Device } from '@/types/device.types';

export type ActionTone = 'default' | 'blue' | 'red' | 'green' | 'amber';

export interface DeviceActionItem {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  tone?: ActionTone;
  onSelect: () => void;
  disabled?: boolean;
  /** Hidden when false (e.g. missing permission). Defaults to true. */
  visible?: boolean;
}

export interface DeviceActionCategory {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  items: DeviceActionItem[];
}

const TONE: Record<ActionTone, string> = {
  default: 'text-foreground hover:bg-muted',
  blue: 'text-blue-600 hover:bg-blue-50',
  red: 'text-red-600 hover:bg-red-50',
  green: 'text-green-700 hover:bg-green-50',
  amber: 'text-amber-700 hover:bg-amber-50',
};

/** Strip hidden items, then drop categories left empty. */
function pruneCategories(categories: DeviceActionCategory[]): DeviceActionCategory[] {
  return categories
    .map((c) => ({ ...c, items: c.items.filter((i) => i.visible !== false) }))
    .filter((c) => c.items.length > 0);
}

function ActionButton({
  item,
  compact,
  onRun,
}: {
  item: DeviceActionItem;
  compact?: boolean;
  onRun: () => void;
}) {
  return (
    <button
      type="button"
      disabled={item.disabled}
      onClick={() => {
        onRun();
        item.onSelect();
      }}
      className={`flex w-full items-center gap-2.5 text-left transition-colors disabled:opacity-50 ${
        compact ? 'px-3 py-2 text-sm' : 'px-4 py-3.5 text-sm'
      } ${TONE[item.tone ?? 'default']}`}
    >
      <item.icon className={compact ? 'h-4 w-4 shrink-0' : 'h-5 w-5 shrink-0'} />
      {item.label}
    </button>
  );
}

/**
 * Two-level categorized per-device actions menu.
 *  - `dropdown` (desktop): a compact popover; each category expands inline (accordion) to reveal
 *    its actions, so the first level shows only ~5 category rows instead of a 20-item wall.
 *  - `sheet` (mobile): a bottom sheet; tapping a category drills into its actions with a back header.
 * Both are driven by the same declarative `categories` list, so new modules only add an entry.
 */
export function DeviceActionsMenu({
  device,
  categories,
  variant,
  onOpen,
  fullWidthTrigger = false,
}: {
  device: Device;
  categories: DeviceActionCategory[];
  variant: 'dropdown' | 'sheet';
  /** Fired once when the menu transitions to open (e.g. to lazily fetch alert status). */
  onOpen?: () => void;
  /** Sheet variant only: render the trigger as a full-width "Actions" bar (mobile card footer). */
  fullWidthTrigger?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const openMenu = () => {
    setOpen(true);
    onOpen?.();
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (variant === 'dropdown' && !rootRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, variant]);

  const close = () => {
    setOpen(false);
    setActiveKey(null);
  };

  const groups = pruneCategories(categories);
  if (groups.length === 0) return null;

  // ── Desktop: dropdown with accordion categories ──────────────────────────
  if (variant === 'dropdown') {
    return (
      <div className="relative inline-block text-left" ref={rootRef}>
        <Button size="sm" variant="outline" onClick={() => (open ? close() : openMenu())} title="More actions">
          <MoreVertical className="h-4 w-4" />
        </Button>
        {open && (
          <div className="absolute right-0 z-30 mt-2 w-60 rounded-md border border-border bg-popover shadow-lg max-h-[70vh] overflow-y-auto py-1">
            {groups.map((cat) => {
              const expanded = activeKey === cat.key;
              return (
                <div key={cat.key}>
                  <button
                    type="button"
                    onClick={() => setActiveKey(expanded ? null : cat.key)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    <cat.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1">{cat.label}</span>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {expanded && (
                    <div className="bg-muted/30 border-y border-border">
                      {cat.items.map((item) => (
                        <ActionButton key={item.key} item={item} compact onRun={close} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Mobile: bottom sheet with drill-in ───────────────────────────────────
  const active = activeKey ? groups.find((g) => g.key === activeKey) ?? null : null;
  return (
    <div className={fullWidthTrigger ? 'w-full' : 'relative ml-auto'}>
      {fullWidthTrigger ? (
        <button
          type="button"
          onClick={openMenu}
          className="w-full min-h-[48px] flex items-center justify-center gap-2 text-sm font-semibold text-blue-600 active:bg-blue-50 transition-colors"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Actions
        </button>
      ) : (
        <button
          type="button"
          onClick={openMenu}
          className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
        >
          <MoreVertical className="h-4 w-4" />
          <span className="text-[10px] font-medium">More</span>
        </button>
      )}
      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 animate-overlay-in" onClick={close} />
          <div className="no-press fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-2xl border-t border-gray-200 bg-white shadow-2xl animate-sheet-up max-h-[80vh]">
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
            {/* Header */}
            <div className="px-4 py-2.5 border-b border-border bg-muted/40 shrink-0">
              {active ? (
                <button type="button" onClick={() => setActiveKey(null)} className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ArrowLeft className="h-4 w-4" /> {active.label}
                </button>
              ) : (
                <>
                  <p className="text-sm font-semibold text-foreground truncate">{device.deviceName || 'Device'}</p>
                  <p className="text-xs text-muted-foreground truncate">{device.userEmail || device.deviceUuid}</p>
                </>
              )}
            </div>
            {/* Body */}
            <div className="overflow-y-auto flex-1 pb-safe">
              {active
                ? active.items.map((item) => <ActionButton key={item.key} item={item} onRun={close} />)
                : groups.map((cat) => (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setActiveKey(cat.key)}
                      className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm text-foreground hover:bg-muted transition-colors"
                    >
                      <cat.icon className="h-5 w-5 text-muted-foreground shrink-0" />
                      <span className="flex-1 font-medium">{cat.label}</span>
                      <span className="text-xs text-muted-foreground">{cat.items.length}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
            </div>
            {/* Close */}
            <div className="shrink-0 p-3 border-t border-border">
              <button
                type="button"
                className="w-full py-3 rounded-md bg-gray-100 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                onClick={close}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
