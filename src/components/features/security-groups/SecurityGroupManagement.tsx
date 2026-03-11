import { useState } from 'react';
import {
  useSecurityGroupsQuery,
  useSecurityGroupPermissionsQuery,
  useCreateSecurityGroup,
  useUpdateSecurityGroup,
  useAddPermission,
  useRemovePermission,
} from '@/hooks/useSecurityGroups';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, ShieldCheck, Plus, X, CheckCircle2, Circle, Loader2, Pencil } from 'lucide-react';
import type { SecurityGroup, PermissionItem } from '@/types/security-group.types';
import { usePermissionStore } from '@/store/permissionStore';
import { Divider } from '@/components/ui/divider';

export function SecurityGroupManagement() {
  const [selectedGroup, setSelectedGroup] = useState<SecurityGroup | null>(null);

  // Create modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createError, setCreateError] = useState('');

  // Edit modal state
  const [editingGroup, setEditingGroup] = useState<SecurityGroup | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editError, setEditError] = useState('');

  const [togglingPermissionId, setTogglingPermissionId] = useState<number | null>(null);

  const hasPermission = usePermissionStore((state) => state.hasPermission);

  const { data: allGroups = [], isLoading: groupsLoading } = useSecurityGroupsQuery();
  const groups = allGroups;
  const { data: matrix, isLoading: permissionsLoading } = useSecurityGroupPermissionsQuery(
    selectedGroup?.id ?? null
  );
  const createMutation = useCreateSecurityGroup();
  const updateMutation = useUpdateSecurityGroup();
  const addPermission = useAddPermission(selectedGroup?.id ?? null);
  const removePermission = useRemovePermission(selectedGroup?.id ?? null);

  // ── Permission toggle ──────────────────────────────────────────────────────
  const handleTogglePermission = async (perm: PermissionItem) => {
    if (togglingPermissionId !== null) return;
    setTogglingPermissionId(perm.permissionId);
    try {
      if (perm.isAllocated) {
        await removePermission.mutateAsync(perm.permissionId);
      } else {
        await addPermission.mutateAsync(perm.permissionId);
      }
    } finally {
      setTogglingPermissionId(null);
    }
  };

  // ── Create handlers ────────────────────────────────────────────────────────
  const handleCreateSubmit = async () => {
    if (!createName.trim()) { setCreateError('Group name is required.'); return; }
    setCreateError('');
    try {
      await createMutation.mutateAsync({ groupName: createName.trim(), description: createDesc.trim() });
      setIsCreateOpen(false);
      setCreateName('');
      setCreateDesc('');
    } catch { /* handled by mutation toast */ }
  };

  const handleCloseCreate = () => {
    if (createMutation.isPending) return;
    setIsCreateOpen(false);
    setCreateName('');
    setCreateDesc('');
    setCreateError('');
  };

  // ── Edit handlers ──────────────────────────────────────────────────────────
  const handleOpenEdit = (group: SecurityGroup, e: React.MouseEvent) => {
    e.stopPropagation(); // don't also select the group in the list
    setEditingGroup(group);
    setEditName(group.groupName);
    setEditDesc(group.description ?? '');
    setEditError('');
  };

  const handleEditSubmit = async () => {
    if (!editName.trim()) { setEditError('Group name is required.'); return; }
    setEditError('');
    try {
      await updateMutation.mutateAsync({
        id: editingGroup!.id,
        data: { groupName: editName.trim(), description: editDesc.trim() },
      });
      // If the edited group is currently selected, keep selection in sync
      if (selectedGroup?.id === editingGroup!.id) {
        setSelectedGroup((prev) => prev ? { ...prev, groupName: editName.trim(), description: editDesc.trim() } : prev);
      }
      setEditingGroup(null);
    } catch { /* handled by mutation toast */ }
  };

  const handleCloseEdit = () => {
    if (updateMutation.isPending) return;
    setEditingGroup(null);
    setEditError('');
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Security Groups</h1>
        {hasPermission('security-group:create') && (
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Group
          </Button>
        )}
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left panel – group list */}
        <Card className="w-1/2 flex flex-col min-h-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Groups
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-auto">
            {groupsLoading ? (
              <div className="p-4 text-sm text-muted-foreground">Loading...</div>
            ) : groups.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No security groups found.</div>
            ) : (
              <ul className="">
                {groups.map((group, index) => (
                  <>
                    <li
                      key={group.id}
                      onClick={() => setSelectedGroup(group)}
                      className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                        selectedGroup?.id === group.id
                          ? 'bg-muted border-l-4 border-primary'
                          : 'border-l-4 border-transparent'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm">{group.groupName}</p>
                        {group.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{group.description}</p>
                        )}
                      </div>
                      {hasPermission('security-group:update') && (
                        <button
                          type="button"
                          onClick={(e) => handleOpenEdit(group, e)}
                          className="ml-2 p-1.5 rounded-md opacity-50 hover:opacity-100 hover:bg-muted transition-all shrink-0"
                          title="Edit group"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </li>
                    {index < groups.length - 1 && <Divider />}
                  </>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Right panel – permission matrix */}
        <Card className="w-1/2 flex flex-col min-h-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              {matrix ? matrix.securityGroupName : selectedGroup ? 'Loading...' : 'Select a group'}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-auto">
            {!selectedGroup ? (
              <div className="p-4 text-sm text-muted-foreground">
                Click a security group on the left to view its permissions.
              </div>
            ) : permissionsLoading ? (
              <div className="p-4 text-sm text-muted-foreground">Loading permissions...</div>
            ) : !matrix || matrix.permissionGroups.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No permissions found for this group.</div>
            ) : (
              <div className="p-4 space-y-5">
                {matrix.permissionGroups.map((group) => {
                  const allocatedCount = group.permissions.filter((p) => p.isAllocated).length;
                  return (
                    <div key={group.permissionGroupId}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {group.permissionGroupName}
                        </span>
                        <div className="flex-1 h-px bg-border" />
                        <span className={`text-xs font-medium ${allocatedCount === group.permissions.length ? 'text-success' : 'text-muted-foreground'}`}>
                          {allocatedCount}/{group.permissions.length}
                        </span>
                      </div>
                      <ul className="space-y-1">
                        {group.permissions.map((perm) => {
                          const isToggling = togglingPermissionId === perm.permissionId;
                          const isDisabled = matrix.securityGroupId !== 1 && !perm.isAllocated && !perm.isAllowed;
                          return (
                            <li
                              key={perm.permissionId}
                              onClick={() => !isDisabled && hasPermission('security-group:update') && handleTogglePermission(perm)}
                              title={isDisabled ? 'This permission is not available for your security group' : undefined}
                              className={`flex items-start gap-2 px-2 py-1.5 rounded-md transition-colors select-none ${
                                isDisabled
                                  ? 'cursor-not-allowed opacity-40'
                                  : !hasPermission('security-group:update')
                                    ? 'cursor-default'
                                    : togglingPermissionId !== null
                                      ? 'cursor-not-allowed opacity-60'
                                      : 'cursor-pointer hover:bg-muted/50'
                              }`}
                            >
                              {isToggling ? (
                                <Loader2 className="h-4 w-4 mt-0.5 shrink-0 animate-spin text-muted-foreground" />
                              ) : perm.isAllocated ? (
                                <CheckCircle2 className="h-4 w-4 mt-0.5 text-success shrink-0" />
                              ) : (
                                <Circle className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                              )}
                              <div className="min-w-0">
                                <p className={`text-sm font-mono font-medium leading-tight ${!perm.isAllocated ? 'text-muted-foreground' : ''}`}>
                                  {perm.permissionName}
                                </p>
                                {perm.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5 leading-tight">
                                    {perm.description}
                                  </p>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md m-4">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Create Security Group</CardTitle>
              <button type="button" onClick={handleCloseCreate} className="opacity-70 hover:opacity-100">
                <X className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sg-createName">Group Name</Label>
                  <Input
                    id="sg-createName"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="e.g. ADMIN_GROUP"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sg-createDesc">Description</Label>
                  <Input
                    id="sg-createDesc"
                    value={createDesc}
                    onChange={(e) => setCreateDesc(e.target.value)}
                    placeholder="Optional description"
                  />
                </div>
                {createError && <p className="text-sm text-destructive">{createError}</p>}
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={handleCloseCreate} disabled={createMutation.isPending}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={handleCreateSubmit} disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Creating...' : 'Create'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Modal */}
      {editingGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md m-4">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Edit Security Group</CardTitle>
              <button type="button" onClick={handleCloseEdit} className="opacity-70 hover:opacity-100">
                <X className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sg-editName">Group Name</Label>
                  <Input
                    id="sg-editName"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="e.g. ADMIN_GROUP"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sg-editDesc">Description</Label>
                  <Input
                    id="sg-editDesc"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    placeholder="Optional description"
                  />
                </div>
                {editError && <p className="text-sm text-destructive">{editError}</p>}
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={handleCloseEdit} disabled={updateMutation.isPending}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleEditSubmit}
                    disabled={
                      updateMutation.isPending ||
                      (editName.trim() === editingGroup.groupName && editDesc.trim() === (editingGroup.description ?? ''))
                    }
                  >
                    {updateMutation.isPending ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
