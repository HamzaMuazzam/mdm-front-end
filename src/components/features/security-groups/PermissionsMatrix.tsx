import { useMemo, useState } from 'react';
import { CheckCircle2, Circle, Loader2, Lock, Search } from 'lucide-react';
import type { PermissionItem, SecurityGroupPermissionMatrix } from '@/types/security-group.types';
import { useAddPermission, useRemovePermission } from '@/hooks/useSecurityGroups';
import { toast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';

interface Props {
  securityGroupId: number;
  matrix: SecurityGroupPermissionMatrix | undefined;
  loading: boolean;
  canEdit: boolean;
}

/** Super-admin's own group sees everything; everyone else only what they could grant. */
const SUPER_ADMIN_GROUP_ID = 1;

/**
 * Permission matrix for one security group: grouped by category, searchable, with
 * per-category "Grant all / Revoke all". Items the viewer cannot grant (outside their
 * own permissions or the parent group's) are shown locked rather than hidden, so admins
 * understand *why* something is unavailable.
 */
export function PermissionsMatrix({ securityGroupId, matrix, loading, canEdit }: Props) {
  const [query, setQuery] = useState('');
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const [busyCategory, setBusyCategory] = useState<number | null>(null);

  const addOne = useAddPermission(securityGroupId);
  const removeOne = useRemovePermission(securityGroupId);
  const addSilent = useAddPermission(securityGroupId, { silent: true });
  const removeSilent = useRemovePermission(securityGroupId, { silent: true });

  const categories = useMemo(() => {
    if (!matrix) return [];
    const q = query.trim().toLowerCase();
    return matrix.permissionGroups
      .map((g) => {
        const visible = g.permissions.filter((p) => matrix.securityGroupId === SUPER_ADMIN_GROUP_ID || p.isAllocated || p.isAllowed);
        const items = q
          ? visible.filter((p) => p.permissionName.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q) || g.permissionGroupName.toLowerCase().includes(q))
          : visible;
        return { ...g, items, grantable: items.filter((p) => p.isAllowed || matrix.securityGroupId === SUPER_ADMIN_GROUP_ID) };
      })
      .filter((g) => g.items.length > 0);
  }, [matrix, query]);

  const totals = useMemo(() => {
    const all = categories.flatMap((c) => c.items);
    return { allocated: all.filter((p) => p.isAllocated).length, total: all.length };
  }, [categories]);

  const toggle = async (perm: PermissionItem) => {
    if (!canEdit || busyIds.has(perm.permissionId) || busyCategory !== null) return;
    if (!perm.isAllowed && !perm.isAllocated && matrix?.securityGroupId !== SUPER_ADMIN_GROUP_ID) return;
    setBusyIds((s) => new Set(s).add(perm.permissionId));
    try {
      if (perm.isAllocated) await removeOne.mutateAsync(perm.permissionId);
      else await addOne.mutateAsync(perm.permissionId);
    } catch { /* toast from hook */ } finally {
      setBusyIds((s) => { const n = new Set(s); n.delete(perm.permissionId); return n; });
    }
  };

  const bulk = async (categoryId: number, grant: boolean) => {
    const cat = categories.find((c) => c.permissionGroupId === categoryId);
    if (!cat || !canEdit || busyCategory !== null) return;
    const targets = cat.grantable.filter((p) => p.isAllocated !== grant);
    if (targets.length === 0) return;
    setBusyCategory(categoryId);
    let ok = 0;
    for (const p of targets) {
      try {
        if (grant) await addSilent.mutateAsync(p.permissionId); else await removeSilent.mutateAsync(p.permissionId);
        ok++;
      } catch { /* continue; the hook already toasted */ }
    }
    setBusyCategory(null);
    toast({
      variant: ok === targets.length ? 'success' : 'destructive',
      title: `${cat.permissionGroupName}: ${ok}/${targets.length} permission${targets.length === 1 ? '' : 's'} ${grant ? 'granted' : 'revoked'}`,
    });
  };

  if (loading) {
    return <div className="space-y-3 p-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-md bg-muted/60" />)}</div>;
  }
  if (!matrix || matrix.permissionGroups.length === 0) {
    return <div className="p-6 text-sm text-muted-foreground">No permissions found for this group.</div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* toolbar */}
      <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter permissions…"
            className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span><span className="font-semibold text-foreground">{totals.allocated}</span> / {totals.total} granted</span>
          <span className="hidden items-center gap-1 sm:inline-flex"><Lock className="h-3 w-3" /> not grantable by you</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-auto p-4">
        {categories.length === 0 && <p className="text-sm text-muted-foreground">Nothing matches “{query}”.</p>}
        {categories.map((cat) => {
          const allocated = cat.items.filter((p) => p.isAllocated).length;
          const allGranted = cat.grantable.length > 0 && cat.grantable.every((p) => p.isAllocated);
          const noneGranted = cat.grantable.every((p) => !p.isAllocated);
          const catBusy = busyCategory === cat.permissionGroupId;
          return (
            <section key={cat.permissionGroupId} aria-label={cat.permissionGroupName}>
              <header className="mb-1.5 flex items-center gap-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{cat.permissionGroupName}</h4>
                <span className={cn('rounded-full px-1.5 text-[11px] font-medium', allocated === cat.items.length ? 'bg-success/10 text-success' : allocated === 0 ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary')}>
                  {allocated}/{cat.items.length}
                </span>
                <div className="h-px flex-1 bg-border" />
                {canEdit && cat.grantable.length > 0 && (
                  <div className="flex items-center gap-1 text-xs">
                    {catBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        <button type="button" disabled={allGranted || busyCategory !== null} onClick={() => bulk(cat.permissionGroupId, true)} className="rounded px-1.5 py-0.5 text-primary hover:bg-primary/10 disabled:opacity-40 disabled:hover:bg-transparent">Grant all</button>
                        <span className="text-border">|</span>
                        <button type="button" disabled={noneGranted || busyCategory !== null} onClick={() => bulk(cat.permissionGroupId, false)} className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent">Revoke all</button>
                      </>
                    )}
                  </div>
                )}
              </header>
              <ul className="overflow-hidden rounded-lg border border-border">
                {cat.items.map((perm, i) => {
                  const locked = !perm.isAllowed && !perm.isAllocated && matrix.securityGroupId !== SUPER_ADMIN_GROUP_ID;
                  const busy = busyIds.has(perm.permissionId) || catBusy;
                  const interactive = canEdit && !locked && !busy;
                  return (
                    <li
                      key={perm.permissionId}
                      role={canEdit ? 'switch' : undefined}
                      aria-checked={canEdit ? perm.isAllocated : undefined}
                      tabIndex={interactive ? 0 : -1}
                      onClick={() => interactive && toggle(perm)}
                      onKeyDown={(e) => { if (interactive && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(perm); } }}
                      title={locked ? 'Your account (or this group’s parent) does not hold this permission, so you cannot grant it.' : undefined}
                      className={cn(
                        'flex items-start gap-2.5 px-3 py-2 transition-colors',
                        i > 0 && 'border-t border-border',
                        perm.isAllocated && 'bg-success/[0.04]',
                        interactive ? 'cursor-pointer hover:bg-muted/50' : locked ? 'cursor-not-allowed opacity-60' : 'cursor-default',
                        busy && 'opacity-60',
                      )}
                    >
                      {busy ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                        : locked ? <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        : perm.isAllocated ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                        : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/70" />}
                      <div className="min-w-0 flex-1">
                        <p className={cn('text-sm leading-tight', perm.isAllocated ? 'font-medium' : 'text-muted-foreground')}>
                          {perm.description || perm.permissionName}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] leading-tight text-muted-foreground/80">{perm.permissionName}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
