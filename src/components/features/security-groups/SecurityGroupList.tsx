import { useMemo, useState } from 'react';
import { ChevronRight, Pencil, Search, Shield, Users } from 'lucide-react';
import type { SecurityGroup } from '@/types/security-group.types';
import { cn } from '@/lib/utils';

interface Props {
  groups: SecurityGroup[];
  loading: boolean;
  selectedId: number | null;
  canEdit: boolean;
  onSelect: (group: SecurityGroup) => void;
  onEdit: (group: SecurityGroup) => void;
}

/** Searchable list of the caller's security groups with member counts. */
export function SecurityGroupList({ groups, loading, selectedId, canEdit, onSelect, onEdit }: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? groups.filter((g) => g.groupName.toLowerCase().includes(q) || (g.description ?? '').toLowerCase().includes(q))
      : groups;
    return [...list].sort((a, b) => a.groupName.localeCompare(b.groupName));
  }, [groups, query]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search groups…"
            className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {loading ? (
          <ul className="space-y-2 p-3">
            {[0, 1, 2].map((i) => <li key={i} className="h-16 animate-pulse rounded-lg bg-muted/60" />)}
          </ul>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            {groups.length === 0 ? 'You have not created any security groups yet.' : 'No groups match your search.'}
          </div>
        ) : (
          <ul className="space-y-1.5 p-2">
            {filtered.map((group) => {
              const active = group.id === selectedId;
              const count = group.userCount ?? 0;
              return (
                <li key={group.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(group)}
                    className={cn(
                      'group flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                      active ? 'border-primary/40 bg-primary/5 shadow-sm' : 'border-transparent hover:border-border hover:bg-muted/40',
                    )}
                  >
                    <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md', active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                      <Shield className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{group.groupName}</span>
                        <span
                          className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium',
                            count === 0 ? 'bg-amber-50 text-amber-700' : 'bg-muted text-muted-foreground')}
                          title={`${count} user${count === 1 ? '' : 's'} assigned`}
                        >
                          <Users className="h-3 w-3" /> {count}
                        </span>
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {group.description || (group.parentGroupName ? `Child of ${group.parentGroupName}` : 'No description')}
                      </span>
                    </span>
                    {canEdit && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); onEdit(group); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onEdit(group); } }}
                        className="hidden rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 sm:block"
                        title="Rename / describe"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground sm:hidden" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
