import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { userSchema } from '@/utils/validators';
import { useUsersQuery, useCreateUser, useDeleteUser, useUpdateUser } from '@/hooks/useUsers';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Manager, CreateManagerRequest, UpdateManagerRequest } from '@/types/user.types';

export function UserManagement() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Manager | null>(null);
  const { data: users = [], isLoading } = useUsersQuery();
  const createMutation = useCreateUser();
  const deleteMutation = useDeleteUser();
  const updateMutation = useUpdateUser();
  const { user: currentUser } = useAuthStore();
  const isL1User = currentUser?.userLevel === 'L1';

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
    if (window.confirm('Are you sure you want to delete this user?')) {
      await deleteMutation.mutateAsync({ id, status: false });
    }
  };

  const handleActivate = async (id: number) => {
    if (window.confirm('Are you sure you want to activate this user?')) {
      await deleteMutation.mutateAsync({ id, status: true });
    }
  };

  const handleEdit = (user: Manager) => {
    setSelectedUser(user);
    setIsEditModalOpen(true);
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
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">User Management</h1>
        <Button onClick={() => setIsModalOpen(true)}>Add User</Button>
      </div>

      {/* User Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
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
                      <div className="flex gap-2">
                        {isL1User && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(user)}
                          >
                            Edit
                          </Button>
                        )}
                        {user.active ? (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(user.id)}
                            disabled={deleteMutation.isPending}
                          >
                            Delete
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleActivate(user.id)}
                            disabled={deleteMutation.isPending}
                          >
                            Activate
                          </Button>
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
    </div>
  );
}
