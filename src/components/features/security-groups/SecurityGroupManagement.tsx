import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Pencil, Plus, Shield, ShieldCheck, Users } from 'lucide-react';
import {
  useCreateSecurityGroup,
  useSecurityGroupPermissionsQuery,
  useSecurityGroupsQuery,
  useUpdateSecurityGroup,
} from '@/hooks/useSecurityGroups';
import { usePermissionStore } from '@/store/permissionStore';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { SecurityGroup } from '@/types/security-group.types';
import { cn } from '@/lib/utils';
import { SecurityGroupList } from './SecurityGroupList';
import { PermissionsMatrix } from './PermissionsMatrix';
import { MembersPanel } from './MembersPanel';
import { GroupFormDialog } from './GroupFormDialog';

type DetailTab = 'permissions' | 'members';

/**
 * Security Groups: master list on the left, detail (Permissions | Members) on the right.
 * On phones the list and detail are two screens with a back button.
 */
export function SecurityGroupManagement() {
  const hasPermission = usePermissionStore((s) => s.hasPermission);
  const canCreate = hasPermission('security-group:create');
  const canEdit = hasPermission('security-group:update');

  const { data: groups = [], isLoading: groupsLoading } = useSecurityGroupsQuery();
  const createMutation = useCreateSecurityGroup();
  const updateMutation = useUpdateSecurityGroup();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [tab, setTab] = useState<DetailTab>('permissions');
  const [form, setForm] = useState<{ open: boolean; group: SecurityGroup | null }>({ open: false, group: null });

  // Keep the selected group object fresh (counts, renames) from the list query.
  const selected = useMemo(() => groups.find((g) => g.id === selectedId) ?? null, [groups, selectedId]);
  useEffect(() => {
    if (selectedId !== null && !groupsLoading && !groups.some((g) => g.id === selectedId)) setSelectedId(null);
  }, [groups, groupsLoading, selectedId]);

  const { data: matrix, isLoading: matrixLoading } = useSecurityGroupPermissionsQuery(selected?.id ?? null);

  const grantedCount = useMemo(
    () => matrix?.permissionGroups.reduce((n, g) => n + g.permissions.filter((p) => p.isAllocated).length, 0) ?? null,
    [matrix],
  );

  const submitForm = async (data: { groupName: string; description: string }) => {
    if (form.group) await updateMutation.mutateAsync({ id: form.group.id, data });
    else {
      const created = await createMutation.mutateAsync(data);
      const id = (created as { data?: { id?: number } })?.data?.id;
      if (typeof id === 'number') { setSelectedId(id); setTab('permissions'); }
    }
    setForm({ open: false, group: null });
  };

  const detailOpen = selected !== null;

  return (
    <div className="flex h-full flex-col">
      {/* page header */}
      <div className={cn('mb-4 flex items-center justify-between gap-3', detailOpen && 'hidden sm:flex')}>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Security Groups</h1>
          <p className="hidden text-sm text-muted-foreground sm:block">Group permissions into roles, then put users in them.</p>
        </div>
        {canCreate && (
          <Button onClick={() => setForm({ open: true, group: null })}>
            <Plus className="mr-1.5 h-4 w-4" /> New group
          </Button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        {/* list */}
        <Card className={cn('flex min-h-0 flex-col overflow-hidden sm:w-[320px] sm:shrink-0 lg:w-[360px]', detailOpen ? 'hidden sm:flex' : 'flex w-full')}>
          <SecurityGroupList
            groups={groups}
            loading={groupsLoading}
            selectedId={selectedId}
            canEdit={canEdit}
            onSelect={(g) => { setSelectedId(g.id); }}
            onEdit={(g) => setForm({ open: true, group: g })}
          />
        </Card>

        {/* detail */}
        <Card className={cn('min-h-0 flex-1 flex-col overflow-hidden', detailOpen ? 'flex' : 'hidden sm:flex')}>
          {!selected ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-10 text-center">
              <Shield className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium">Select a security group</p>
              <p className="max-w-xs text-xs text-muted-foreground">Pick a group on the left to review its permissions and the users assigned to it.</p>
            </div>
          ) : (
            <>
              {/* detail header */}
              <div className="border-b border-border px-4 pt-3">
                <div className="flex items-start gap-3">
                  <button type="button" className="-ml-1 mt-0.5 rounded-md p-1 hover:bg-muted sm:hidden" onClick={() => setSelectedId(null)} aria-label="Back to groups">
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-base font-semibold">{selected.groupName}</h2>
                      {canEdit && (
                        <button type="button" onClick={() => setForm({ open: true, group: selected })} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" title="Rename / describe">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {selected.description || 'No description'}
                      {selected.parentGroupName && <> · child of <span className="font-medium">{selected.parentGroupName}</span></>}
                    </p>
                  </div>
                </div>

                <nav className="-mb-px mt-3 flex gap-1" role="tablist">
                  <TabButton active={tab === 'permissions'} onClick={() => setTab('permissions')} icon={<ShieldCheck className="h-4 w-4" />} label="Permissions" count={grantedCount} />
                  <TabButton active={tab === 'members'} onClick={() => setTab('members')} icon={<Users className="h-4 w-4" />} label="Members" count={selected.userCount ?? 0} />
                </nav>
              </div>

              <div className="min-h-0 flex-1">
                {tab === 'permissions' ? (
                  <PermissionsMatrix securityGroupId={selected.id} matrix={matrix} loading={matrixLoading} canEdit={canEdit} />
                ) : (
                  <MembersPanel group={selected} groups={groups} canEdit={canEdit} />
                )}
              </div>
            </>
          )}
        </Card>
      </div>

      {form.open && (
        <GroupFormDialog
          group={form.group}
          pending={createMutation.isPending || updateMutation.isPending}
          onSubmit={submitForm}
          onClose={() => !(createMutation.isPending || updateMutation.isPending) && setForm({ open: false, group: null })}
        />
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon, label, count }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count: number | null }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors',
        active ? 'border-primary font-medium text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      {icon} {label}
      {count !== null && <span className={cn('rounded-full px-1.5 text-[11px]', active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>{count}</span>}
    </button>
  );
}
