import { useEffect, useRef, useState, type ComponentType } from 'react';
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
export function BulkActionsMenu({ groups }: { groups: BulkActionGroup[] }) {
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
