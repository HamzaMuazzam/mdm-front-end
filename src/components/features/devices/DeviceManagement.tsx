import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { deviceSchema } from '@/utils/validators';
import { useDevicesQuery, useCreateDevice, useDeleteDevice } from '@/hooks/useDevices';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CreateDeviceRequest } from '@/types/device.types';

export function DeviceManagement() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data: devices = [], isLoading } = useDevicesQuery();
  const createMutation = useCreateDevice();
  const deleteMutation = useDeleteDevice();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateDeviceRequest>({
    resolver: zodResolver(deviceSchema),
  });

  const onSubmit = async (data: CreateDeviceRequest) => {
    try {
      await createMutation.mutateAsync(data);
      setIsModalOpen(false);
      reset();
    } catch (err) {
      console.error('Failed to create device', err);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this device?')) {
      await deleteMutation.mutateAsync(id);
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
                  <th className="px-4 py-3 text-left text-sm font-medium">ID</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Device UUID</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Phone</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">User Email</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Model</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">OS Version</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Description</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {devices.map((device) => (
                  <tr key={device.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 text-sm">{device.id}</td>
                    <td className="px-4 py-3 text-sm">{device.deviceUuid}</td>
                    <td className="px-4 py-3 text-sm">{device.phone}</td>
                    <td className="px-4 py-3 text-sm">{device.userEmail}</td>
                    <td className="px-4 py-3 text-sm">{device.model}</td>
                    <td className="px-4 py-3 text-sm">{device.osVersion}</td>
                    <td className="px-4 py-3 text-sm">{device.description || '-'}</td>
                    <td className="px-4 py-3 text-sm">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(device.id)}
                        disabled={deleteMutation.isPending}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
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
    </div>
  );
}
