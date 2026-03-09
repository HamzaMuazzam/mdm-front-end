import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { userSchema } from '@/utils/validators';
import { useUsersQuery, useCreateUser, useDeleteUser, useUpdateUser, useResetUserPassword } from '@/hooks/useUsers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MoreVertical, Pencil, RotateCcw, Trash2, CheckCircle } from 'lucide-react';
import type { Manager, CreateManagerRequest, UpdateManagerRequest } from '@/types/user.types';
import { usePermissionStore } from '@/store/permissionStore';

export function UserManagement() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [openActionMenuUserId, setOpenActionMenuUserId] = useState<number | null>(null);
  const [selectedUser, setSelectedUser] = useState<Manager | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');
  const [resetPasswordError, setResetPasswordError] = useState('');
  const { data: users = [], isLoading } = useUsersQuery();
  const createMutation = useCreateUser();
  const deleteMutation = useDeleteUser();
  const updateMutation = useUpdateUser();
  const resetPasswordMutation = useResetUserPassword();
  const hasPermission = usePermissionStore((state) => state.hasPermission);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateManagerRequest>({
    resolver: zodResolver(userSchema),
  });

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEdit,
    setValue: setEditValue,
    formState: { errors: editErrors },
  } = useForm<Omit<UpdateManagerRequest, 'id'>>();

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
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const onSubmit = async (data: CreateManagerRequest) => {
    try {
      await createMutation.mutateAsync(data);
      setIsModalOpen(false);
      reset();
    } catch (err) {
      console.error('Failed to create user', err);
    }
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

  const handleEdit = (user: Manager) => {
    setOpenActionMenuUserId(null);
    setSelectedUser(user);
    setIsEditModalOpen(true);
  };

  const handleOpenActionsMenu = (userId: number) => {
    setOpenActionMenuUserId((previous) => (previous === userId ? null : userId));
  };

  const handleOpenResetPassword = (user: Manager) => {
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

    if (!resetPassword || !confirmResetPassword) {
      setResetPasswordError('Both password fields are required.');
      return;
    }

    if (resetPassword !== confirmResetPassword) {
      setResetPasswordError('Passwords do not match.');
      return;
    }

    setResetPasswordError('');

    try {
      await resetPasswordMutation.mutateAsync({
        email: selectedUser.email,
        password: resetPassword,
      });
      handleCloseResetPassword();
    } catch (err) {
      // handled by mutation toast
      console.error('Failed to reset password', err);
    }
  };

  const onEditSubmit = async (data: Omit<UpdateManagerRequest, 'id'>) => {
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

  if (isLoading) {
    return <div>Loading users...</div>;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">User Management</h1>
        {hasPermission('user:create') && (
          <Button onClick={() => setIsModalOpen(true)}>Add User</Button>
        )}
      </div>

      {/* User Table */}
      <Card className="flex-1 min-h-0">
        <CardContent className="h-full p-0">
          <div className="h-full overflow-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">ID</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Login</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">User Name</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Phone</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Active</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className={`hover:bg-muted/50 ${!user.active ? 'bg-gray-100 text-gray-400' : ''}`}
                  >
                    <td className="px-4 py-3 text-sm">{user.id}</td>
                    <td className="px-4 py-3 text-sm">{user.login}</td>
                    <td className="px-4 py-3 text-sm">{user.email}</td>
                    <td className="px-4 py-3 text-sm">{user.userName}</td>
                    <td className="px-4 py-3 text-sm">{user.phone}</td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-block px-2 py-1 text-xs rounded-full ${
                          user.active
                            ? 'bg-success/10 text-success'
                            : 'bg-destructive/10 text-destructive'
                        }`}
                      >
                        {user.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="relative inline-block text-left" data-user-actions-menu>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenActionsMenu(user.id)}
                          title="More actions"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>

                        {openActionMenuUserId === user.id && (
                          <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
                            {hasPermission('user:update') && (
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                                onClick={() => handleEdit(user)}
                              >
                                <Pencil className="h-4 w-4" />
                                Edit
                              </button>
                            )}

                            {hasPermission('user:update') && (
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                                onClick={() => handleOpenResetPassword(user)}
                              >
                                <RotateCcw className="h-4 w-4" />
                                Reset Password
                              </button>
                            )}

                            {hasPermission('user:delete') && (
                              <>
                                <div className="my-1 h-px bg-slate-200 dark:bg-slate-700" />
                                {user.active ? (
                                  <button
                                    type="button"
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/30"
                                    onClick={() => handleDelete(user.id)}
                                    disabled={deleteMutation.isPending}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Delete
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                                    onClick={() => handleActivate(user.id)}
                                    disabled={deleteMutation.isPending}
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                    Activate
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md m-4">
            <CardHeader>
              <CardTitle>Add New User</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login">Login</Label>
                  <Input id="login" {...register('login')} />
                  {errors.login && <p className="text-sm text-destructive">{errors.login.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" {...register('email')} />
                  {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="userName">User Name</Label>
                  <Input id="userName" {...register('userName')} />
                  {errors.userName && (
                    <p className="text-sm text-destructive">{errors.userName.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" {...register('phone')} />
                  {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" {...register('password')} />
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password.message}</p>
                  )}
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsModalOpen(false);
                      reset();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Creating...' : 'Create User'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit User Modal - L1 Users Only */}
      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md m-4">
            <CardHeader>
              <CardTitle>Edit User</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitEdit(onEditSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-userName">User Name</Label>
                  <Input id="edit-userName" {...registerEdit('userName')} />
                  {editErrors.userName && (
                    <p className="text-sm text-destructive">{editErrors.userName.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input id="edit-email" type="email" {...registerEdit('email')} />
                  {editErrors.email && (
                    <p className="text-sm text-destructive">{editErrors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-phone">Phone</Label>
                  <Input id="edit-phone" {...registerEdit('phone')} />
                  {editErrors.phone && (
                    <p className="text-sm text-destructive">{editErrors.phone.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-profileImg">Profile Image URL</Label>
                  <Input id="edit-profileImg" {...registerEdit('profileImg')} />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit-active"
                    {...registerEdit('active')}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="edit-active">Active</Label>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsEditModalOpen(false);
                      setSelectedUser(null);
                      resetEdit();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? 'Updating...' : 'Update User'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reset Password Modal */}
      {isResetPasswordModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md m-4">
            <CardHeader>
              <CardTitle>Reset Password</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  User: <span className="font-medium text-foreground">{selectedUser.email}</span>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reset-password">New Password</Label>
                  <Input
                    id="reset-password"
                    type="password"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reset-confirm-password">Confirm Password</Label>
                  <Input
                    id="reset-confirm-password"
                    type="password"
                    value={confirmResetPassword}
                    onChange={(e) => setConfirmResetPassword(e.target.value)}
                  />
                </div>

                {resetPasswordError && (
                  <p className="text-sm text-destructive">{resetPasswordError}</p>
                )}

                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCloseResetPassword}
                    disabled={resetPasswordMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleResetPasswordSubmit}
                    disabled={resetPasswordMutation.isPending}
                  >
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
