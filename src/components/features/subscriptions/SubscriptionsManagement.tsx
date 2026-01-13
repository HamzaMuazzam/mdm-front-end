import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { deviceSchema, updateDeviceSchema } from '@/utils/validators';
import { useDevicesQuery, useCreateDevice, useToggleDeviceStatus, useUpdateDevice } from '@/hooks/useDevices';
import { useLevel2UsersQuery } from '@/hooks/useUsers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CreateDeviceRequest, UpdateDeviceRequest, Device } from '@/types/device.types';

export function SubscriptionsManagement() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isToggleDialogOpen, setIsToggleDialogOpen] = useState(false);
  const [deviceToToggle, setDeviceToToggle] = useState<Device | null>(null);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const { data: devices = [], isLoading } = useDevicesQuery();
  const { data: level2Users = [], isLoading: isLoadingUsers } = useLevel2UsersQuery();
  const createMutation = useCreateDevice();
  const updateMutation = useUpdateDevice();
  const toggleStatusMutation = useToggleDeviceStatus();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CreateDeviceRequest>({
    resolver: zodResolver(deviceSchema),
  });

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEdit,
    setValue: setEditValue,
    formState: { errors: editErrors },
  } = useForm<UpdateDeviceRequest>({
    resolver: zodResolver(updateDeviceSchema),
  });

  useEffect(() => {
    if (level2Users.length > 0) {
      setValue('userId', level2Users[0].id);
    }
  }, [level2Users, setValue]);

  useEffect(() => {
    if (editingDevice && isEditModalOpen) {
      setEditValue('phone', editingDevice.phone || '');
      setEditValue('model', editingDevice.model || '');
      setEditValue('osVersion', editingDevice.osVersion || '');
      setEditValue('description', editingDevice.description || '');
      setEditValue('cpuArchitecture', editingDevice.cpuArchitecture || '');
      setEditValue('isDeviceAdmin', editingDevice.isDeviceAdmin || false);
      setEditValue('canOverlayWindows', editingDevice.canOverlayWindows || false);
      setEditValue('canAccessUsageHistory', editingDevice.canAccessUsageHistory || false);
      setEditValue('canAccessAccessibility', editingDevice.canAccessAccessibility || false);
      setEditValue('batteryCharge', editingDevice.batteryCharge || 0);
      setEditValue('launcherVariant', editingDevice.launcherVariant || '');
      setEditValue('defaultLauncher', editingDevice.defaultLauncher || '');
      setEditValue('userId', editingDevice.userId);
    }
  }, [editingDevice, isEditModalOpen, setEditValue]);

  const onSubmit = async (data: CreateDeviceRequest) => {
    try {
      await createMutation.mutateAsync(data);
      setIsModalOpen(false);
      reset();
    } catch (err) {
      console.error('Failed to create device', err);
    }
  };

  const handleToggleClick = (device: Device) => {
    setDeviceToToggle(device);
    setIsToggleDialogOpen(true);
  };

  const handleToggleConfirm = async () => {
    if (!deviceToToggle) return;
    const isCurrentlyActive = !(deviceToToggle.deletedAt == null);
    try {
      await toggleStatusMutation.mutateAsync({
        id: deviceToToggle.id,
        isActive: isCurrentlyActive, // Send false to deactivate, true to activate
      });
      setIsToggleDialogOpen(false);
      setDeviceToToggle(null);
    } catch (err) {
      console.error('Failed to toggle device status', err);
    }
  };

  const handleEdit = (device: Device) => {
    setEditingDevice(device);
    setIsEditModalOpen(true);
  };

  const onEditSubmit = async (data: UpdateDeviceRequest) => {
    if (!editingDevice) return;
    try {
      await updateMutation.mutateAsync({ id: editingDevice.id, ...data });
      setIsEditModalOpen(false);
      setEditingDevice(null);
      resetEdit();
    } catch (err) {
      console.error('Failed to update device', err);
    }
  };

  if (isLoading) {
    return <div>Loading devices...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Device Management</h1>
        <Button onClick={() => setIsModalOpen(true)}>Add Device</Button>
      </div>

      {/* Device Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  {/*<th className="px-4 py-3 text-left text-sm font-medium">ID</th>*/}
                  <th className="px-4 py-3 text-left text-sm font-medium">Device UUID</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Phone</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">User Name</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">User Email</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Model</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">OS Version</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Description</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                  {/*<th className="px-4 py-3 text-left text-sm font-medium">Deleted At</th>*/}
                  <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {devices.map((device:Device) => {
                  const isActive = !device.deletedAt;
                  return (
                    <tr
                      key={device.id}
                      className={`hover:bg-muted/50 ${!isActive ? 'opacity-50 bg-muted/30' : ''}`}
                    >
                      {/*<td className="px-4 py-3 text-sm">{device.id}</td>*/}
                      <td className="px-4 py-3 text-sm">{device.deviceUuid}</td>
                      <td className="px-4 py-3 text-sm">{device.phone}</td>
                      <td className="px-4 py-3 text-sm">{device.userName}</td>
                      <td className="px-4 py-3 text-sm">{device.userEmail}</td>
                      <td className="px-4 py-3 text-sm">{device.model}</td>
                      <td className="px-4 py-3 text-sm">{device.osVersion}</td>
                      <td className="px-4 py-3 text-sm">{device.description || '-'}</td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            isActive
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          }`}
                        >
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      {/*<td className="px-4 py-3 text-sm">{device.deletedAt || '-'}</td>*/}
                      <td className="px-4 py-3 text-sm">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(device)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant={isActive ? 'destructive' : 'default'}
                            onClick={() => handleToggleClick(device)}
                            disabled={toggleStatusMutation.isPending}
                          >
                            {isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add Device Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md m-4 max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Add New Device</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="deviceUuid">Device UUID</Label>
                  <Input id="deviceUuid" {...register('deviceUuid')} />
                  {errors.deviceUuid && (
                    <p className="text-sm text-destructive">{errors.deviceUuid.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" {...register('phone')} />
                  {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="userEmail">User Email</Label>
                  <Input id="userEmail" type="email" {...register('userEmail')} />
                  {errors.userEmail && (
                    <p className="text-sm text-destructive">{errors.userEmail.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="userId">Assign User</Label>
                  <select
                    id="userId"
                    {...register('userId', { valueAsNumber: true })}
                    className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isLoadingUsers}
                  >
                    {isLoadingUsers ? (
                      <option value="">Loading users...</option>
                    ) : (
                      level2Users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.userName} ({user.email})
                        </option>
                      ))
                    )}
                  </select>
                  {errors.userId && (
                    <p className="text-sm text-destructive">{errors.userId.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Input id="model" {...register('model')} />
                  {errors.model && <p className="text-sm text-destructive">{errors.model.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="osVersion">OS Version</Label>
                  <Input id="osVersion" {...register('osVersion')} />
                  {errors.osVersion && (
                    <p className="text-sm text-destructive">{errors.osVersion.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Input id="description" {...register('description')} />
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
                    {createMutation.isPending ? 'Creating...' : 'Create Device'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Device Modal */}
      {isEditModalOpen && editingDevice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md m-4 max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Edit Device</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitEdit(onEditSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-phone">Phone</Label>
                  <Input id="edit-phone" {...registerEdit('phone')} />
                  {editErrors.phone && (
                    <p className="text-sm text-destructive">{editErrors.phone.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-model">Model</Label>
                  <Input id="edit-model" {...registerEdit('model')} />
                  {editErrors.model && (
                    <p className="text-sm text-destructive">{editErrors.model.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-osVersion">OS Version</Label>
                  <Input id="edit-osVersion" {...registerEdit('osVersion')} />
                  {editErrors.osVersion && (
                    <p className="text-sm text-destructive">{editErrors.osVersion.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Input id="edit-description" {...registerEdit('description')} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-cpuArchitecture">CPU Architecture</Label>
                  <Input id="edit-cpuArchitecture" {...registerEdit('cpuArchitecture')} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-launcherVariant">Launcher Variant</Label>
                  <Input id="edit-launcherVariant" {...registerEdit('launcherVariant')} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-defaultLauncher">Default Launcher</Label>
                  <Input id="edit-defaultLauncher" {...registerEdit('defaultLauncher')} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-batteryCharge">Battery Charge</Label>
                  <Input
                    id="edit-batteryCharge"
                    type="number"
                    {...registerEdit('batteryCharge', { valueAsNumber: true })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-userId">Assign User</Label>
                  <select
                    id="edit-userId"
                    {...registerEdit('userId', { valueAsNumber: true })}
                    className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isLoadingUsers}
                  >
                    {isLoadingUsers ? (
                      <option value="">Loading users...</option>
                    ) : (
                      level2Users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.userName} ({user.email})
                        </option>
                      ))
                    )}
                  </select>
                  {editErrors.userId && (
                    <p className="text-sm text-destructive">{editErrors.userId.message}</p>
                  )}
                </div>

                <div className="space-y-3">
                  <Label>Device Permissions</Label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        {...registerEdit('isDeviceAdmin')}
                        className="h-4 w-4 rounded border-input"
                      />
                      <span className="text-sm">Device Admin</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        {...registerEdit('canOverlayWindows')}
                        className="h-4 w-4 rounded border-input"
                      />
                      <span className="text-sm">Can Overlay Windows</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        {...registerEdit('canAccessUsageHistory')}
                        className="h-4 w-4 rounded border-input"
                      />
                      <span className="text-sm">Can Access Usage History</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        {...registerEdit('canAccessAccessibility')}
                        className="h-4 w-4 rounded border-input"
                      />
                      <span className="text-sm">Can Access Accessibility</span>
                    </label>
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsEditModalOpen(false);
                      setEditingDevice(null);
                      resetEdit();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? 'Updating...' : 'Update Device'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Toggle Status Confirmation Dialog */}
      {isToggleDialogOpen && deviceToToggle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-sm m-4">
            <CardHeader>
              <CardTitle>
                {!deviceToToggle.deletedAt ? 'Deactivate Device' : 'Activate Device'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {!deviceToToggle.deletedAt
                  ? `Are you sure you want to deactivate the device "${deviceToToggle.deviceUuid}"? This will mark the device as inactive.`
                  : `Are you sure you want to activate the device "${deviceToToggle.deviceUuid}"? This will restore the device to active status.`}
              </p>
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsToggleDialogOpen(false);
                    setDeviceToToggle(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant={!deviceToToggle.deletedAt ? 'destructive' : 'default'}
                  onClick={handleToggleConfirm}
                  disabled={toggleStatusMutation.isPending}
                >
                  {toggleStatusMutation.isPending
                    ? 'Processing...'
                    : !deviceToToggle.deletedAt
                      ? 'Deactivate'
                      : 'Activate'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
