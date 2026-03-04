import { useState } from 'react';
import { useRolesQuery, useCreateRole, useUpdateRoleSecurityGroup } from '@/hooks/useRoles';
import { useSecurityGroupsQuery } from '@/hooks/useSecurityGroups';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, X, Pencil } from 'lucide-react';
import type { Role } from '@/types/role.types';

export function RoleManagement() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  // Create form state
  const [roleName, setRoleName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedSgId, setSelectedSgId] = useState<number | ''>('');
  const [formError, setFormError] = useState('');

  // Edit form state
  const [editSgId, setEditSgId] = useState<number | ''>('');

  const { data: roles = [], isLoading } = useRolesQuery();
  const { data: securityGroups = [] } = useSecurityGroupsQuery();
  const createMutation = useCreateRole();
  const updateMutation = useUpdateRoleSecurityGroup();

  const handleCreateSubmit = async () => {
    if (!roleName.trim()) { setFormError('Role name is required.'); return; }
    if (!selectedSgId) { setFormError('Security group is required.'); return; }
    setFormError('');
    try {
      await createMutation.mutateAsync({
        roleName: roleName.trim(),
        description: description.trim(),
        securityGroupId: Number(selectedSgId),
      });
      setIsCreateOpen(false);
      setRoleName('');
      setDescription('');
      setSelectedSgId('');
    } catch {
      // handled by mutation toast
    }
  };

  const handleCloseCreate = () => {
    if (createMutation.isPending) return;
    setIsCreateOpen(false);
    setRoleName('');
    setDescription('');
    setSelectedSgId('');
    setFormError('');
  };

  const handleOpenEdit = (role: Role) => {
    setEditingRole(role);
    setEditSgId(role.securityGroupId);
  };

  const handleCloseEdit = () => {
    if (updateMutation.isPending) return;
    setEditingRole(null);
    setEditSgId('');
  };

  const handleUpdateSubmit = async () => {
    if (!editingRole || !editSgId) return;
    try {
      await updateMutation.mutateAsync({ roleId: editingRole.id, securityGroupId: Number(editSgId) });
      handleCloseEdit();
    } catch {
      // handled by mutation toast
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Role Management</h1>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Role
        </Button>
      </div>

      <Card className="flex-1 min-h-0">
        <CardContent className="h-full p-0">
          <div className="h-full overflow-auto">
            {isLoading ? (
              <div className="p-4 text-sm text-muted-foreground">Loading...</div>
            ) : roles.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No roles found.</div>
            ) : (
              <table className="w-full">
                <thead className="bg-muted/50 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium">ID</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Role Name</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Description</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Security Group</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Created At</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {roles.map((role) => (
                    <tr key={role.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 text-sm text-muted-foreground">{role.id}</td>
                      <td className="px-4 py-3 text-sm font-medium font-mono">{role.roleName}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground max-w-xs truncate">
                        {role.description || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs bg-primary/10 text-primary border border-primary/20">
                          {role.securityGroupName}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                        {role.createdAt ? role.createdAt.replace('T', ' ').slice(0, 19) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenEdit(role)}
                          title="Change security group"
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          Edit Group
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create Role Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md m-4">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Create Role</CardTitle>
              <button type="button" onClick={handleCloseCreate} className="opacity-70 hover:opacity-100">
                <X className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="r-roleName">Role Name</Label>
                  <Input
                    id="r-roleName"
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                    placeholder="e.g. MANAGER"
                    maxLength={50}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="r-description">Description</Label>
                  <Input
                    id="r-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional description"
                    maxLength={255}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="r-securityGroup">Security Group</Label>
                  <select
                    id="r-securityGroup"
                    value={selectedSgId}
                    onChange={(e) => setSelectedSgId(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <option value="">Select a security group…</option>
                    {securityGroups.map((sg) => (
                      <option key={sg.id} value={sg.id}>
                        {sg.groupName}
                      </option>
                    ))}
                  </select>
                </div>

                {formError && <p className="text-sm text-destructive">{formError}</p>}

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

      {/* Edit Security Group Modal */}
      {editingRole && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-sm m-4">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Change Security Group</CardTitle>
              <button type="button" onClick={handleCloseEdit} className="opacity-70 hover:opacity-100">
                <X className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Role: <span className="font-medium text-foreground font-mono">{editingRole.roleName}</span>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="e-securityGroup">Security Group</Label>
                  <select
                    id="e-securityGroup"
                    value={editSgId}
                    onChange={(e) => setEditSgId(Number(e.target.value))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    {securityGroups.map((sg) => (
                      <option key={sg.id} value={sg.id}>
                        {sg.groupName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={handleCloseEdit} disabled={updateMutation.isPending}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleUpdateSubmit}
                    disabled={updateMutation.isPending || editSgId === editingRole.securityGroupId}
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
