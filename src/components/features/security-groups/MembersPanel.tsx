import { useMemo, useState } from 'react';
import { ArrowRightLeft, Loader2, Search, UserMinus, UserPlus, X } from 'lucide-react';
import type { SecurityGroup } from '@/types/security-group.types';
import type { User } from '@/types/auth.types';
import {
  useMoveSecurityGroupUsers,
  useSecurityGroupEligibleUsersQuery,
  useSecurityGroupMembersQuery,
} from '@/hooks/useSecurityGroups';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Props {
  group: SecurityGroup;
  /** Every group the viewer may move users into (their own list). */
  groups: SecurityGroup[];
  canEdit: boolean;
}

type PendingAction =
  | { kind: 'move'; userIds: number[]; targetId: number }
  | { kind: 'remove'; userIds: number[] };

/**
 * Who is in this group. Row and bulk actions: Move to… (another group), Remove (unassign),
 * Add users (picker of users under the viewer's account not yet in the group).
 */
export function MembersPanel({ group, groups, canEdit }: Props) {
  const me = useAuthStore((s) => s.user);
  const { data: members = [], isLoading } = useSecurityGroupMembersQuery(group.id);
  const move = useMoveSecurityGroupUsers(group.id);

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const otherGroups = useMemo(() => groups.filter((g) => g.id !== group.id).sort((a, b) => a.groupName.localeCompare(b.groupName)), [groups, group.id]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? members.filter((u) => (u.userName ?? '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) : members;
  }, [members, query]);

  const selectable = filtered.filter((u) => u.id !== me?.id);
  const allSelected = selectable.length > 0 && selectable.every((u) => selected.has(u.id));

  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(selectable.map((u) => u.id)));
  const toggleOne = (id: number) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const run = async (action: PendingAction) => {
    try {
      await move.mutateAsync({ userIds: action.userIds, targetSecurityGroupId: action.kind === 'move' ? action.targetId : null });
      setSelected(new Set());
      setPending(null);
    } catch { /* toast from hook */ }
  };

  const nameOf = (id: number) => groups.find((g) => g.id === id)?.groupName ?? `group #${id}`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* toolbar */}
      <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search members…"
            className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">{members.length}</span> member{members.length === 1 ? '' : 's'}</span>
          {canEdit && (
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <UserPlus className="mr-1.5 h-4 w-4" /> Add users
            </Button>
          )}
        </div>
      </div>

      {/* bulk bar */}
      {canEdit && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-primary/20 bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <div className="h-4 w-px bg-border" />
          <MoveToSelect groups={otherGroups} disabled={move.isPending} onPick={(targetId) => setPending({ kind: 'move', userIds: [...selected], targetId })} />
          <Button size="sm" variant="outline" className="text-red-700 hover:bg-red-50" disabled={move.isPending} onClick={() => setPending({ kind: 'remove', userIds: [...selected] })}>
            <UserMinus className="mr-1.5 h-4 w-4" /> Remove from group
          </Button>
          <button type="button" className="ml-auto rounded p-1 text-muted-foreground hover:bg-muted" onClick={() => setSelected(new Set())} aria-label="Clear selection"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* list */}
      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading ? (
          <div className="space-y-2 p-3">{[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-md bg-muted/60" />)}</div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <UserPlus className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm font-medium">No users in this group</p>
            <p className="max-w-xs text-xs text-muted-foreground">Users you add here get exactly the permissions on the Permissions tab.</p>
            {canEdit && <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>Add users</Button>}
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No members match “{query}”.</p>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 bg-gray-50 text-left text-[11px] font-medium uppercase tracking-wide text-gray-500">
              <tr>
                {canEdit && <th className="w-8 px-3 py-2"><input type="checkbox" className="h-4 w-4" checked={allSelected} onChange={toggleAll} aria-label="Select all" disabled={selectable.length === 0} /></th>}
                <th className="px-3 py-2">User</th>
                <th className="hidden px-3 py-2 md:table-cell">Status</th>
                {canEdit && <th className="px-3 py-2 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((u) => {
                const isMe = u.id === me?.id;
                return (
                  <tr key={u.id} className={cn('hover:bg-muted/40', selected.has(u.id) && 'bg-primary/5')}>
                    {canEdit && (
                      <td className="px-3 py-2">
                        <input type="checkbox" className="h-4 w-4" checked={selected.has(u.id)} onChange={() => toggleOne(u.id)} disabled={isMe} aria-label={`Select ${u.email}`} />
                      </td>
                    )}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{(u.userName || u.email).charAt(0).toUpperCase()}</span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{u.userName || '—'}{isMe && <span className="ml-1.5 rounded bg-muted px-1 text-[10px] font-normal text-muted-foreground">you</span>}</p>
                          <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-3 py-2 md:table-cell">
                      <span className={cn('rounded-full border px-2 py-0.5 text-xs font-medium', u.active ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700')}>{u.active ? 'Active' : 'Inactive'}</span>
                    </td>
                    {canEdit && (
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          {isMe ? (
                            <span className="text-xs text-muted-foreground" title="You cannot change your own group">—</span>
                          ) : (
                            <>
                              <MoveToSelect compact groups={otherGroups} disabled={move.isPending} onPick={(targetId) => setPending({ kind: 'move', userIds: [u.id], targetId })} />
                              <button type="button" title="Remove from group" className="rounded-md p-1.5 text-red-600 hover:bg-red-50" disabled={move.isPending} onClick={() => setPending({ kind: 'remove', userIds: [u.id] })}>
                                <UserMinus className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* confirm */}
      {pending && (
        <Dialog title={pending.kind === 'remove' ? 'Remove from security group?' : `Move to ${nameOf(pending.targetId)}?`} onClose={() => !move.isPending && setPending(null)}>
          <p className="text-sm text-muted-foreground">
            {pending.userIds.length === 1 ? 'This user' : `${pending.userIds.length} users`} will {pending.kind === 'remove' ? 'no longer belong to any security group' : <>leave <b className="text-foreground">{group.groupName}</b> and get the permissions of <b className="text-foreground">{nameOf(pending.targetId)}</b></>}.
          </p>
          {pending.kind === 'remove' && (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">Without a group they can sign in but will see an empty portal until one is assigned.</p>
          )}
          <p className="text-xs text-muted-foreground">Changes reach their open sessions within a minute.</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setPending(null)} disabled={move.isPending} className="w-full sm:w-auto">Cancel</Button>
            <Button variant={pending.kind === 'remove' ? 'destructive' : 'default'} onClick={() => run(pending)} disabled={move.isPending} className="w-full sm:w-auto">
              {move.isPending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Saving…</> : pending.kind === 'remove' ? 'Remove' : 'Move'}
            </Button>
          </div>
        </Dialog>
      )}

      {addOpen && <AddUsersDialog group={group} onClose={() => setAddOpen(false)} />}
    </div>
  );
}

// ── pieces ──────────────────────────────────────────────────────────────────

function MoveToSelect({ groups, disabled, compact, onPick }: { groups: SecurityGroup[]; disabled: boolean; compact?: boolean; onPick: (id: number) => void }) {
  if (groups.length === 0) return null;
  return (
    <label className={cn('relative inline-flex items-center', compact ? '' : 'gap-1.5')}>
      {!compact && <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />}
      <select
        value=""
        disabled={disabled}
        onChange={(e) => { if (e.target.value) onPick(Number(e.target.value)); e.target.value = ''; }}
        className={cn('rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring', compact ? 'h-8 max-w-[150px] px-1.5' : 'h-8 px-2')}
        aria-label="Move to group"
        title="Move to another group"
      >
        <option value="">Move to…</option>
        {groups.map((g) => <option key={g.id} value={g.id}>{g.groupName}</option>)}
      </select>
    </label>
  );
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <Card className="w-full rounded-b-none sm:max-w-md sm:rounded-lg" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="pb-3"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
        <CardContent className="space-y-3">{children}</CardContent>
      </Card>
    </div>
  );
}

function AddUsersDialog({ group, onClose }: { group: SecurityGroup; onClose: () => void }) {
  const { data: eligible = [], isLoading } = useSecurityGroupEligibleUsersQuery(group.id);
  const move = useMoveSecurityGroupUsers(group.id);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Set<number>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? eligible.filter((u) => (u.userName ?? '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.securityGroupName ?? '').toLowerCase().includes(q)) : eligible;
  }, [eligible, query]);

  const submit = async () => {
    try {
      await move.mutateAsync({ userIds: [...picked], targetSecurityGroupId: group.id });
      onClose();
    } catch { /* toast from hook */ }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4" onClick={() => !move.isPending && onClose()}>
      <Card className="flex max-h-[92dvh] w-full flex-col rounded-b-none sm:max-w-lg sm:rounded-lg" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Add users to {group.groupName}</CardTitle>
          <button type="button" onClick={onClose} className="rounded-md p-1 opacity-70 hover:bg-muted hover:opacity-100" aria-label="Close"><X className="h-4 w-4" /></button>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, email or current group…" className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border">
            {isLoading ? (
              <div className="p-4 text-sm text-muted-foreground">Loading users…</div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">{eligible.length === 0 ? 'Every user under your account is already in this group.' : 'No users match.'}</div>
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map((u: User) => {
                  const on = picked.has(u.id);
                  return (
                    <li key={u.id}>
                      <label className={cn('flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/40', on && 'bg-primary/5')}>
                        <input type="checkbox" className="h-4 w-4" checked={on} onChange={() => setPicked((s) => { const n = new Set(s); n.has(u.id) ? n.delete(u.id) : n.add(u.id); return n; })} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{u.userName || '—'}</span>
                          <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
                        </span>
                        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium', u.securityGroupName ? 'bg-muted text-muted-foreground' : 'bg-amber-50 text-amber-700')}>
                          {u.securityGroupName ?? 'No group'}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Users already in another group are moved out of it.</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={onClose} disabled={move.isPending} className="w-full sm:w-auto">Cancel</Button>
            <Button onClick={submit} disabled={picked.size === 0 || move.isPending} className="w-full sm:w-auto">
              {move.isPending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Adding…</> : `Add ${picked.size || ''} user${picked.size === 1 ? '' : 's'}`.replace('  ', ' ')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
