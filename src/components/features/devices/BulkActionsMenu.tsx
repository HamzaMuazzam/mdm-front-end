import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { ChevronDown, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface BulkActionItem {
  label: string;
  icon: ComponentType<{ className?: string }>;
  onClick: () => void;
  /** Hidden when false (e.g. missing permission). Defaults to true. */
  visible?: boolean;
}

export interface BulkActionGroup {
  label: string;
  items: BulkActionItem[];
}

/**
 * A single "Bulk Actions" launcher that houses every module's bulk-assignment flow behind one
 * toolbar button. Actions are grouped by category so the toolbar stays clean as more modules are
 * added. Empty groups (all items hidden by permission) are omitted automatically.
 */
export function BulkActionsMenu({
  groups,
  variant = 'dropdown',
  renderTrigger,
}: {
  groups: BulkActionGroup[];
  /** `dropdown` (default, desktop toolbar) or `sheet` (mobile bottom sheet). */
  variant?: 'dropdown' | 'sheet';
  /** Custom trigger (mobile tile etc.). Receives the open callback. */
  renderTrigger?: (open: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Drop items hidden by permission, then drop groups left empty.
  const visibleGroups = groups
    .map((g) => ({ ...g, items: g.items.filter((i) => i.visible !== false) }))
    .filter((g) => g.items.length > 0);

  if (visibleGroups.length === 0) return null;

  // ── Mobile: bottom sheet ──────────────────────────────────────────────
  if (variant === 'sheet') {
    return (
      <div className="flex-1 min-w-0" ref={rootRef}>
        {renderTrigger ? (
          renderTrigger(() => setOpen(true))
        ) : (
          <Button variant="outline" onClick={() => setOpen(true)} className="w-full">
            <Layers className="h-4 w-4 mr-2" />
            Bulk
          </Button>
        )}
        {open && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/40 animate-overlay-in"
              onClick={() => setOpen(false)}
            />
            <div className="no-press fixed bottom-0 inset-x-0 z-50 flex flex-col rounded-t-2xl bg-white shadow-2xl animate-sheet-up max-h-[80vh]">
              <div className="flex justify-center pt-2.5 pb-1 shrink-0">
                <div className="h-1 w-10 rounded-full bg-gray-300" />
              </div>
              <div className="px-5 py-2.5 border-b border-border shrink-0">
                <p className="text-sm font-semibold text-foreground">Bulk Operations</p>
                <p className="text-xs text-muted-foreground">Apply a change to multiple devices at once</p>
              </div>
              <div className="overflow-y-auto flex-1 pb-safe">
                {visibleGroups.map((group) => (
                  <div key={group.label}>
                    <p className="px-5 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {group.label}
                    </p>
                    {group.items.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          item.onClick();
                        }}
                        className="flex w-full min-h-[48px] items-center gap-3 px-5 text-left text-sm font-medium text-foreground active:bg-muted transition-colors"
                      >
                        <item.icon className="h-4 w-4 text-blue-600 shrink-0" />
                        {item.label}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
              <div className="shrink-0 p-3 border-t border-border pb-safe">
                <button
                  type="button"
                  className="w-full min-h-[48px] rounded-xl bg-gray-100 text-sm font-medium text-gray-700 active:bg-gray-200 transition-colors"
                  onClick={() => setOpen(false)}
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

  return (
    <div className="relative flex-1 sm:flex-none" ref={rootRef}>
      <Button
        variant="outline"
        onClick={() => setOpen((v) => !v)}
        className="w-full sm:w-auto border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300"
      >
        <Layers className="h-4 w-4 mr-2" />
        Bulk Actions
        <ChevronDown className={`h-4 w-4 ml-1.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </Button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-64 origin-top-right rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
          <div className="max-h-[70vh] overflow-y-auto py-1">
            {visibleGroups.map((group, gi) => (
              <div key={group.label}>
                {gi > 0 && <div className="my-1 h-px bg-border" />}
                <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </p>
                {group.items.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      item.onClick();
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-foreground hover:bg-muted transition-colors"
                  >
                    <item.icon className="h-4 w-4 text-blue-600 shrink-0" />
                    {item.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
