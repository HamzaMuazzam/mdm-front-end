import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useUsersQuery, useCreateUser, useDeleteUser, useUpdateUser, useResetUserPassword } from '@/hooks/useUsers';
import { useSecurityGroupsQuery } from '@/hooks/useSecurityGroups';
import { useAllPlansQuery } from '@/hooks/useSubscriptions';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MoreVertical, Pencil, RotateCcw, Trash2, CheckCircle } from 'lucide-react';
import type { UpdateUserRequest } from '@/types/user.types';
import type { User } from '@/types/auth.types';
import { usePermissionStore } from '@/store/permissionStore';

interface CreateUserForm {
  email: string;
  userName: string;
  phone: string;
  password: string;
  securityGroupId: number | '';
  copyConfiguration: boolean;
  planId: number | '';
}

const EMPTY_CREATE_FORM: CreateUserForm = {
  email: '',
  userName: '',
  phone: '',
  password: '',
  securityGroupId: '',
  copyConfiguration: true,
  planId: '',
};

export function UserManagement() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [openActionMenuUserId, setOpenActionMenuUserId] = useState<number | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');
  const [resetPasswordError, setResetPasswordError] = useState('');
  const [createForm, setCreateForm] = useState<CreateUserForm>(EMPTY_CREATE_FORM);
  const [createFormError, setCreateFormError] = useState('');

  const loggedInUser = useAuthStore((state) => state.user);
  const hasPermission = usePermissionStore((state) => state.hasPermission);
  const { data: users = [], isLoading, isError } = useUsersQuery();
  const { data: securityGroups = [] } = useSecurityGroupsQuery();
  const { data: allPlans = [] } = useAllPlansQuery();
  const createMutation = useCreateUser();
  const deleteMutation = useDeleteUser();
  const updateMutation = useUpdateUser();
  const resetPasswordMutation = useResetUserPassword();

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEdit,
    setValue: setEditValue,
    formState: { errors: editErrors },
  } = useForm<Omit<UpdateUserRequest, 'id'>>();

  useEffect(() => {
    if (selectedUser && isEditModalOpen) {
      setEditValue('userName', selectedUser.userName || '');
      setEditValue('email', selectedUser.email || '');
      setEditValue('phone', selectedUser.phone || '');
      setEditValue('active', selectedUser.active);
    }
  }, [selectedUser, isEditModalOpen, setEditValue]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-user-actions-menu]')) {
        setOpenActionMenuUserId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreateFieldChange = (field: keyof CreateUserForm, value: string | number | boolean) => {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateSubmit = async () => {
    if (!createForm.email.trim()) { setCreateFormError('Email is required.'); return; }
    if (!createForm.password || createForm.password.length < 8) { setCreateFormError('Password must be at least 8 characters.'); return; }
    setCreateFormError('');
    try {
      await createMutation.mutateAsync({
        login: createForm.email,
        email: createForm.email,
        userName: createForm.userName || undefined,
        password: createForm.password,
        phone: createForm.phone || undefined,
        parentId: loggedInUser?.id ?? null,
        copyConfiguration: createForm.copyConfiguration,
        securityGroupId: createForm.securityGroupId !== '' ? Number(createForm.securityGroupId) : null,
        planId: createForm.planId !== '' ? Number(createForm.planId) : null,
        active: true,
      });
      setIsModalOpen(false);
      setCreateForm(EMPTY_CREATE_FORM);
    } catch (err) {
      console.error('Failed to create user', err);
    }
  };

  const handleCloseCreate = () => {
    if (createMutation.isPending) return;
    setIsModalOpen(false);
    setCreateForm(EMPTY_CREATE_FORM);
    setCreateFormError('');
  };

  const handleDelete = async (id: number) => {
    setOpenActionMenuUserId(null);
    if (window.confirm('Are you sure you want to delete this user?')) {
      await deleteMutation.mutateAsync({ id, status: false });
    }
  };

  const handleActivate = async (id: number) => {
    setOpenActionMenuUserId(null);
    if (window.confirm('Are you sure you want to activate this user?')) {
      await deleteMutation.mutateAsync({ id, status: true });
    }
  };

  const handleEdit = (user: User) => {
    setOpenActionMenuUserId(null);
    setSelectedUser(user);
    setIsEditModalOpen(true);
  };

  const handleOpenActionsMenu = (userId: number) => {
    setOpenActionMenuUserId((previous) => (previous === userId ? null : userId));
  };

  const handleOpenResetPassword = (user: User) => {
    setOpenActionMenuUserId(null);
    setSelectedUser(user);
    setResetPassword('');
    setConfirmResetPassword('');
    setResetPasswordError('');
    setIsResetPasswordModalOpen(true);
  };

  const handleCloseResetPassword = () => {
    if (resetPasswordMutation.isPending) return;
    setIsResetPasswordModalOpen(false);
    setSelectedUser(null);
    setResetPassword('');
    setConfirmResetPassword('');
    setResetPasswordError('');
  };

  const handleResetPasswordSubmit = async () => {
    if (!selectedUser) return;
    if (!resetPassword || !confirmResetPassword) { setResetPasswordError('Both password fields are required.'); return; }
    if (resetPassword !== confirmResetPassword) { setResetPasswordError('Passwords do not match.'); return; }
    setResetPasswordError('');
    try {
      await resetPasswordMutation.mutateAsync({ email: selectedUser.email, password: resetPassword });
      handleCloseResetPassword();
    } catch (err) {
      console.error('Failed to reset password', err);
    }
  };

  const onEditSubmit = async (data: Omit<UpdateUserRequest, 'id'>) => {
    if (!selectedUser) return;
    try {
      await updateMutation.mutateAsync({ id: selectedUser.id, ...data });
      setIsEditModalOpen(false);
      setSelectedUser(null);
      resetEdit();
    } catch (err) {
      console.error('Failed to update user', err);
    }
  };

  // ── Action dropdown (shared by card + table) ────────────────────────────────
  const ActionMenu = ({ user }: { user: User }) => (
    <div className="relative inline-block text-left" data-user-actions-menu>
      <Button size="sm" variant="outline" onClick={() => handleOpenActionsMenu(user.id)} title="More actions">
        <MoreVertical className="h-4 w-4" />
      </Button>
      {openActionMenuUserId === user.id && (
        <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-md border border-border bg-popover shadow-lg">
          {hasPermission('user:update') && (
            <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => handleEdit(user)}>
              <Pencil className="h-4 w-4" /> Edit
            </button>
          )}
          {hasPermission('user:update') && (
            <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => handleOpenResetPassword(user)}>
              <RotateCcw className="h-4 w-4" /> Reset Password
            </button>
          )}
          {hasPermission('user:delete') && (
            <>
              <div className="my-1 h-px bg-border" />
              {user.active ? (
                <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50" onClick={() => handleDelete(user.id)} disabled={deleteMutation.isPending}>
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              ) : (
                <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-green-700 hover:bg-green-50" onClick={() => handleActivate(user.id)} disabled={deleteMutation.isPending}>
                  <CheckCircle className="h-4 w-4" /> Activate
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );

  if (isLoading) return <div className="p-4 text-muted-foreground">Loading users...</div>;
  if (isError) return <div className="p-4 text-destructive">Failed to load users. You may not have permission to view this page.</div>;

  return (
    <div className="flex h-full flex-col gap-4">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <h1 className="text-xl font-semibold text-gray-900">User Management</h1>
        {hasPermission('user:create') && (
          <Button onClick={() => setIsModalOpen(true)} className="w-full sm:w-auto">Add User</Button>
        )}
      </div>

      {/* ── Mobile: card list (hidden on sm+) ──────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:hidden">
        {users.length === 0 && (
          <p className="text-center text-muted-foreground py-8 text-sm">No users found.</p>
        )}
        {users.map((user) => (
          <Card key={user.id} className={`${!user.active ? 'opacity-60' : ''}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                {/* Avatar + info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-semibold text-primary">
                      {(user.userName || user.email || '?').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{user.userName || '—'}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    {user.phone && <p className="text-xs text-muted-foreground">{user.phone}</p>}
                  </div>
                </div>
                {/* Status + actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium border ${
                    user.active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                  }`}>
                    {user.active ? 'Active' : 'Inactive'}
                  </span>
                  <ActionMenu user={user} />
                </div>
              </div>
              {/* ID row */}
              <p className="text-xs text-muted-foreground/60 mt-2">ID: {user.id}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Desktop: full table (hidden below sm) ──────────────────────────── */}
      <Card className="hidden sm:flex flex-col flex-1 min-h-0">
        <CardContent className="h-full p-0">
          <div className="h-full overflow-auto">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">User Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((user) => (
                  <tr key={user.id} className={`hover:bg-muted/40 ${!user.active ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3 text-sm">{user.id}</td>
                    <td className="px-4 py-3 text-sm">{user.email}</td>
                    <td className="px-4 py-3 text-sm">{user.userName}</td>
                    <td className="px-4 py-3 text-sm">{user.phone}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-block px-2 py-1 text-xs rounded-full font-medium border ${
                        user.active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {user.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <ActionMenu user={user} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Add User Modal ─────────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <Card className="w-full sm:max-w-md rounded-b-none sm:rounded-lg max-h-[92dvh] overflow-y-auto">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Add New User</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="cu-email">Email <span className="text-destructive">*</span></Label>
                  <Input id="cu-email" type="email" placeholder="user@example.com" value={createForm.email} onChange={(e) => handleCreateFieldChange('email', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cu-userName">User Name <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input id="cu-userName" placeholder="Display name" value={createForm.userName} onChange={(e) => handleCreateFieldChange('userName', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cu-phone">Phone <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input id="cu-phone" type="tel" placeholder="+1234567890" value={createForm.phone} onChange={(e) => handleCreateFieldChange('phone', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cu-password">Password <span className="text-destructive">*</span></Label>
                  <Input id="cu-password" type="password" placeholder="Min 8 characters" value={createForm.password} onChange={(e) => handleCreateFieldChange('password', e.target.value)} />
                </div>
                {hasPermission('user:allow to assign security group') && (
                  <div className="space-y-1.5">
                    <Label htmlFor="cu-sg">Security Group <span className="text-muted-foreground text-xs">(optional)</span></Label>
                    <select id="cu-sg" value={createForm.securityGroupId} onChange={(e) => handleCreateFieldChange('securityGroupId', e.target.value === '' ? '' : Number(e.target.value))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                      <option value="">No security group</option>
                      {securityGroups.map((sg) => <option key={sg.id} value={sg.id}>{sg.groupName}</option>)}
                    </select>
                  </div>
                )}
                {hasPermission('user:allow to assign a plan') && (
                  <div className="space-y-1.5">
                    <Label htmlFor="cu-plan">Subscription Plan <span className="text-muted-foreground text-xs">(optional)</span></Label>
                    <select id="cu-plan" value={createForm.planId} onChange={(e) => handleCreateFieldChange('planId', e.target.value === '' ? '' : Number(e.target.value))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                      <option value="">No plan</option>
                      {allPlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.subscriptionName} — {plan.currency}{plan.price} / {plan.validityDays}d</option>)}
                    </select>
                  </div>
                )}
                {hasPermission('user:allow to copy configurations') && (
                  <div className="flex items-center justify-between rounded-md border border-border px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">Copy Configuration</p>
                      <p className="text-xs text-muted-foreground">Copy parent configuration to this user</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={createForm.copyConfiguration} onChange={(e) => handleCreateFieldChange('copyConfiguration', e.target.checked)} className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                    </label>
                  </div>
                )}
                {createFormError && <p className="text-sm text-destructive">{createFormError}</p>}
                <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-1">
                  <Button type="button" variant="outline" onClick={handleCloseCreate} disabled={createMutation.isPending} className="w-full sm:w-auto">Cancel</Button>
                  <Button type="button" onClick={handleCreateSubmit} disabled={createMutation.isPending} className="w-full sm:w-auto">
                    {createMutation.isPending ? 'Creating...' : 'Create User'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Edit User Modal ─────────────────────────────────────────────────── */}
      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <Card className="w-full sm:max-w-md rounded-b-none sm:rounded-lg max-h-[92dvh] overflow-y-auto">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Edit User</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitEdit(onEditSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-userName">User Name</Label>
                  <Input id="edit-userName" {...registerEdit('userName')} />
                  {editErrors.userName && <p className="text-sm text-destructive">{editErrors.userName.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input id="edit-email" type="email" {...registerEdit('email')} />
                  {editErrors.email && <p className="text-sm text-destructive">{editErrors.email.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-phone">Phone</Label>
                  <Input id="edit-phone" {...registerEdit('phone')} />
                  {editErrors.phone && <p className="text-sm text-destructive">{editErrors.phone.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-profileImg">Profile Image URL</Label>
                  <Input id="edit-profileImg" {...registerEdit('profileImg')} />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="edit-active" {...registerEdit('active')} className="h-4 w-4" />
                  <Label htmlFor="edit-active">Active</Label>
                </div>
                <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-1">
                  <Button type="button" variant="outline" onClick={() => { setIsEditModalOpen(false); setSelectedUser(null); resetEdit(); }} className="w-full sm:w-auto">Cancel</Button>
                  <Button type="submit" disabled={updateMutation.isPending} className="w-full sm:w-auto">
                    {updateMutation.isPending ? 'Updating...' : 'Update User'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Reset Password Modal ────────────────────────────────────────────── */}
      {isResetPasswordModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <Card className="w-full sm:max-w-md rounded-b-none sm:rounded-lg max-h-[92dvh] overflow-y-auto">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Reset Password</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  User: <span className="font-medium text-foreground">{selectedUser.email}</span>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reset-password">New Password</Label>
                  <Input id="reset-password" type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reset-confirm-password">Confirm Password</Label>
                  <Input id="reset-confirm-password" type="password" value={confirmResetPassword} onChange={(e) => setConfirmResetPassword(e.target.value)} />
                </div>
                {resetPasswordError && <p className="text-sm text-destructive">{resetPasswordError}</p>}
                <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-1">
                  <Button type="button" variant="outline" onClick={handleCloseResetPassword} disabled={resetPasswordMutation.isPending} className="w-full sm:w-auto">Cancel</Button>
                  <Button type="button" onClick={handleResetPasswordSubmit} disabled={resetPasswordMutation.isPending} className="w-full sm:w-auto">
                    {resetPasswordMutation.isPending ? 'Submitting...' : 'Submit'}
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
