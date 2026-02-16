import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { deviceSchema, updateDeviceSchema } from '@/utils/validators';
import { useDevicesQuery, useCreateDevice, useToggleDeviceStatus, useUpdateDevice, useDeviceConfiguration, useUpdateDeviceConfiguration, useApplicationPermissionGranters, useFeatureStates, useLocationTrackingTypes, usePushNotificationProtocols } from '@/hooks/useDevices';
import { useLevel2UsersQuery } from '@/hooks/useUsers';
import { useDeviceStatusMqtt, useDeviceStatusStore } from '@/hooks/useDeviceStatus';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Wifi, MapPin, Bell, Smartphone, Monitor, Lock, X, Check, AlertCircle, Pencil, Save, AppWindow, Key, FileText, QrCode, Download } from 'lucide-react';
import QRCode from 'qrcode';
import type { CreateDeviceRequest, UpdateDeviceRequest, Device, UpdateDeviceConfigurationRequest } from '@/types/device.types';

export function DeviceManagement() {
  const navigate = useNavigate();
  useDeviceStatusMqtt();
  const deviceStatuses = useDeviceStatusStore((s) => s.statuses);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isToggleDialogOpen, setIsToggleDialogOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isConfigEditMode, setIsConfigEditMode] = useState(false);
  const [deviceToToggle, setDeviceToToggle] = useState<Device | null>(null);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [configDeviceId, setConfigDeviceId] = useState<number | null>(null);
  const [configFormData, setConfigFormData] = useState<UpdateDeviceConfigurationRequest>({});
  const { data: devices = [], isLoading } = useDevicesQuery();
  const { data: deviceConfig, isLoading: isLoadingConfig } = useDeviceConfiguration(configDeviceId);
  const { data: level2Users = [], isLoading: isLoadingUsers } = useLevel2UsersQuery();
  const createMutation = useCreateDevice();
  const updateMutation = useUpdateDevice();
  const toggleStatusMutation = useToggleDeviceStatus();
  const updateConfigMutation = useUpdateDeviceConfiguration();

  // Configuration enum data
  const { data: permissionGranters = [] } = useApplicationPermissionGranters();
  const { data: featureStates = [] } = useFeatureStates();
  const { data: locationTrackingTypes = [] } = useLocationTrackingTypes();
  const { data: pushNotificationProtocols = [] } = usePushNotificationProtocols();

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

  // Load logged-in user email from localStorage and generate QR on mount
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        const email = user.email || '';
        setUserEmail(email);
        if (email) {
          QRCode.toDataURL(email, {
            width: 300,
            margin: 2,
            color: { dark: '#000000', light: '#ffffff' },
            errorCorrectionLevel: 'H',
          }).then(setQrDataUrl).catch(() => setQrDataUrl(''));
        }
      } catch {
        setUserEmail('');
      }
    }
  }, []);

  const handleDownloadQr = useCallback(() => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.download = 'qr-code.png';
    link.href = qrDataUrl;
    link.click();
  }, [qrDataUrl]);

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

  const handleViewConfig = (device: Device) => {
    setConfigDeviceId(device.id);
    setIsConfigModalOpen(true);
    setIsConfigEditMode(false);
  };

  // Initialize config form data when deviceConfig loads
  useEffect(() => {
    if (deviceConfig) {
      setConfigFormData({
        configName: deviceConfig.configName,
        description: deviceConfig.description || '',
        unlockPassword: deviceConfig.unlockPassword || '',
        locationTrackingByTypeId: deviceConfig.locationTrackingByTypeId,
        applicationPermissionGranterTypeId: deviceConfig.applicationPermissionGranterTypeId,
        pushNotificationProtocolTypeId: deviceConfig.pushNotificationProtocolTypeId,
        wifiStateId: deviceConfig.wifiStateId,
        gpsStateId: deviceConfig.gpsStateId,
        notificationBarStateId: deviceConfig.notificationBarStateId,
        mobileDataStateId: deviceConfig.mobileDataStateId,
        blockExternalStorage: deviceConfig.blockExternalStorage,
        manageScreenTimeout: deviceConfig.manageScreenTimeout,
        screenTimeoutSeconds: deviceConfig.screenTimeoutSeconds,
        lockVolume: deviceConfig.lockVolume,
        volumePercentage: deviceConfig.volumePercentage,
        isDefaultLauncher: deviceConfig.isDefaultLauncher,
        isInstalledAsDeviceOwner: deviceConfig.isInstalledAsDeviceOwner,
        useDefaultLauncherTheme: deviceConfig.useDefaultLauncherTheme,
        backgroundColor: deviceConfig.backgroundColor,
        applicationNamesColor: deviceConfig.applicationNamesColor,
        backgroundImageUrl: deviceConfig.backgroundImageUrl || '',
        iconSize: deviceConfig.iconSize,
        lockSystemOrientation: deviceConfig.lockSystemOrientation,
        lockLauncherOrientation: deviceConfig.lockLauncherOrientation,
        launcherOrientation: deviceConfig.launcherOrientation,
        hideSystemNotificationBarInLauncher: deviceConfig.hideSystemNotificationBarInLauncher,
        showLauncherOwnNotificationBar: deviceConfig.showLauncherOwnNotificationBar,
        enableHomeButton: deviceConfig.enableHomeButton,
        enableRecentsButton: deviceConfig.enableRecentsButton,
        enableNotifications: deviceConfig.enableNotifications,
        enableStatusBarInfo: deviceConfig.enableStatusBarInfo,
        enableScreenLock: deviceConfig.enableScreenLock,
        lockPowerButton: deviceConfig.lockPowerButton,
        enableKioskMode: deviceConfig.enableKioskMode,
        kioskModePackageId: deviceConfig.kioskModePackageId || '',
        screenAlwaysOn: deviceConfig.screenAlwaysOn,
        newServerURL: deviceConfig.newServerURL || '',
        deviceAdminCode: deviceConfig.deviceAdminCode || '',
        isDeviceAdminCodeEnabled: deviceConfig.isDeviceAdminCodeEnabled,
        allowToAccessSensitiveSettings: deviceConfig.allowToAccessSensitiveSettings,
      });
    }
  }, [deviceConfig]);

  const handleConfigSave = async () => {
    if (!deviceConfig) return;
    try {
      await updateConfigMutation.mutateAsync({
        configId: deviceConfig.id,
        ...configFormData,
      });
      setIsConfigEditMode(false);
    } catch (err) {
      console.error('Failed to update configuration', err);
    }
  };

  const handleConfigInputChange = (field: keyof UpdateDeviceConfigurationRequest, value: any) => {
    setConfigFormData(prev => {
      const newData = { ...prev, [field]: value };

      // Logic to ensure WiFi and Mobile Data cannot be disabled at the same time
      if (field === 'wifiStateId' || field === 'mobileDataStateId') {
        const wifiDisabledId = featureStates.find(s => s.name === 'DISABLED')?.id;
        const mobileDataDisabledId = featureStates.find(s => s.name === 'DISABLED')?.id;
        const enabledId = featureStates.find(s => s.name === 'ENABLED')?.id;

        if (wifiDisabledId !== undefined && mobileDataDisabledId !== undefined && enabledId !== undefined) {
          const newWifiStateId = field === 'wifiStateId' ? value : prev.wifiStateId;
          const newMobileDataStateId = field === 'mobileDataStateId' ? value : prev.mobileDataStateId;

          if (newWifiStateId === wifiDisabledId && newMobileDataStateId === mobileDataDisabledId) {
            // If both are being disabled, enable the other one
            if (field === 'wifiStateId') {
               newData.mobileDataStateId = enabledId;
            } else {
               newData.wifiStateId = enabledId;
            }
          }
        }
      }
      return newData;
    });
  };

  const handleViewApps = (device: Device) => {
    navigate(`/device/${device.id}/applications`);
  };

  const handleViewRequests = (device: Device) => {
    navigate(`/device/${device.id}/requests`);
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

  const handleShowCode = (code: number | undefined) => {
    if (code) {
      alert(`Device Verification Code: ${code}`);
    } else {
      alert('No verification code available for this device.');
    }
  };

  if (isLoading) {
    return <div>Loading devices...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Device Management</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsQrModalOpen(true)}>
            <QrCode className="h-4 w-4 mr-2" />
            QR View
          </Button>
          <Button onClick={() => setIsModalOpen(true)}>Add Device</Button>
        </div>
      </div>

      {/* Device Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  {/*<th className="px-4 py-3 text-left text-sm font-medium">ID</th>*/}
                  <th className="px-4 py-3 text-center text-sm font-medium">Live</th>
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
                      <td className="px-4 py-3 text-sm text-center">
                        <DeviceStatusDot status={deviceStatuses[device.deviceUuid]} />
                      </td>
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
                            onClick={() => handleShowCode(device.deviceVerificationCode)}
                            title="Show Verification Code"
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewConfig(device)}
                            title="View Configuration"
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewApps(device)}
                            title="View Applications"
                          >
                            <AppWindow className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewRequests(device)}
                            title="View Requests"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
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

      {/* QR Code Modal */}
      {isQrModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-sm m-4">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Your QR Code</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsQrModalOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              {qrDataUrl ? (
                <>
                  <img src={qrDataUrl} alt="QR Code" className="w-[250px] h-[250px]" />
                  <p className="text-sm text-muted-foreground">{userEmail}</p>
                  <Button onClick={handleDownloadQr}>
                    <Download className="h-4 w-4 mr-2" />
                    Download QR Code
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No user email found.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Device Configuration Modal */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-4xl m-4 max-h-[90vh] overflow-hidden flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Device Configuration
                  {isConfigEditMode && <span className="text-sm font-normal text-muted-foreground">(Editing)</span>}
                </CardTitle>
                {deviceConfig && !isConfigEditMode && (
                  <p className="text-sm text-muted-foreground mt-1">{deviceConfig.configName}</p>
                )}
              </div>
              <div className="flex gap-2">
                {deviceConfig && !isConfigEditMode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsConfigEditMode(true)}
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                )}
                {isConfigEditMode && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsConfigEditMode(false);
                        // Reset form data to original values
                        if (deviceConfig) {
                          setConfigFormData({
                            configName: deviceConfig.configName,
                            description: deviceConfig.description || '',
                            unlockPassword: deviceConfig.unlockPassword || '',
                            locationTrackingByTypeId: deviceConfig.locationTrackingByTypeId,
                            applicationPermissionGranterTypeId: deviceConfig.applicationPermissionGranterTypeId,
                            pushNotificationProtocolTypeId: deviceConfig.pushNotificationProtocolTypeId,
                            wifiStateId: deviceConfig.wifiStateId,
                            gpsStateId: deviceConfig.gpsStateId,
                            notificationBarStateId: deviceConfig.notificationBarStateId,
                            mobileDataStateId: deviceConfig.mobileDataStateId,
                            blockExternalStorage: deviceConfig.blockExternalStorage,
                            manageScreenTimeout: deviceConfig.manageScreenTimeout,
                            screenTimeoutSeconds: deviceConfig.screenTimeoutSeconds,
                            lockVolume: deviceConfig.lockVolume,
                            volumePercentage: deviceConfig.volumePercentage,
                            isDefaultLauncher: deviceConfig.isDefaultLauncher,
                            isInstalledAsDeviceOwner: deviceConfig.isInstalledAsDeviceOwner,
                            useDefaultLauncherTheme: deviceConfig.useDefaultLauncherTheme,
                            backgroundColor: deviceConfig.backgroundColor,
                            applicationNamesColor: deviceConfig.applicationNamesColor,
                            backgroundImageUrl: deviceConfig.backgroundImageUrl || '',
                            iconSize: deviceConfig.iconSize,
                            lockSystemOrientation: deviceConfig.lockSystemOrientation,
                            lockLauncherOrientation: deviceConfig.lockLauncherOrientation,
                            launcherOrientation: deviceConfig.launcherOrientation,
                            hideSystemNotificationBarInLauncher: deviceConfig.hideSystemNotificationBarInLauncher,
                            showLauncherOwnNotificationBar: deviceConfig.showLauncherOwnNotificationBar,
                            enableHomeButton: deviceConfig.enableHomeButton,
                            enableRecentsButton: deviceConfig.enableRecentsButton,
                            enableNotifications: deviceConfig.enableNotifications,
                            enableStatusBarInfo: deviceConfig.enableStatusBarInfo,
                            enableScreenLock: deviceConfig.enableScreenLock,
                            lockPowerButton: deviceConfig.lockPowerButton,
                            enableKioskMode: deviceConfig.enableKioskMode,
                            kioskModePackageId: deviceConfig.kioskModePackageId || '',
                            screenAlwaysOn: deviceConfig.screenAlwaysOn,
                            newServerURL: deviceConfig.newServerURL || '',
                            deviceAdminCode: deviceConfig.deviceAdminCode || '',
                            isDeviceAdminCodeEnabled: deviceConfig.isDeviceAdminCodeEnabled,
                            allowToAccessSensitiveSettings: deviceConfig.allowToAccessSensitiveSettings,
                          });
                        }
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleConfigSave}
                      disabled={updateConfigMutation.isPending}
                    >
                      <Save className="h-4 w-4 mr-1" />
                      {updateConfigMutation.isPending ? 'Saving...' : 'Save'}
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsConfigModalOpen(false);
                    setConfigDeviceId(null);
                    setIsConfigEditMode(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-y-auto p-6">
              {isLoadingConfig ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : deviceConfig ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* General Settings */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-lg font-semibold border-b pb-2">
                      <Smartphone className="h-5 w-5 text-blue-500" />
                      General Settings
                    </div>
                    <ConfigEditItem
                      label="Configuration Name"
                      value={deviceConfig.configName}
                      editValue={configFormData.configName || ''}
                      isEditMode={isConfigEditMode}
                      onChange={(v) => handleConfigInputChange('configName', v)}
                      type="text"
                    />
                    <ConfigEditItem
                      label="Description"
                      value={deviceConfig.description || 'No description'}
                      editValue={configFormData.description || ''}
                      isEditMode={isConfigEditMode}
                      onChange={(v) => handleConfigInputChange('description', v)}
                      type="text"
                    />
                    <ConfigItem label="Is Parent Config" value={<BooleanBadge value={deviceConfig.isParentConfig} />} />
                    <ConfigEditItem
                      label="Icon Size"
                      value={deviceConfig.iconSize}
                      editValue={configFormData.iconSize || ''}
                      isEditMode={isConfigEditMode}
                      onChange={(v) => handleConfigInputChange('iconSize', v)}
                      type="select"
                      options={[
                        { value: 'small', label: 'Small' },
                        { value: 'medium', label: 'Medium' },
                        { value: 'large', label: 'Large' },
                      ]}
                    />
                  </div>

                  {/* Connectivity Settings */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-lg font-semibold border-b pb-2">
                      <Wifi className="h-5 w-5 text-green-500" />
                      Connectivity
                    </div>
                    <ConfigEditItem
                      label="WiFi State"
                      value={<StateBadge value={deviceConfig.wifiStateName} />}
                      editValue={configFormData.wifiStateId?.toString() || '0'}
                      isEditMode={isConfigEditMode}
                      onChange={(v) => handleConfigInputChange('wifiStateId', parseInt(v))}
                      type="select"
                      options={featureStates.map(state => ({ value: state.id.toString(), label: state.title }))}
                    />
                    <ConfigEditItem
                      label="Mobile Data State"
                      value={<StateBadge value={deviceConfig.mobileDataStateName} />}
                      editValue={configFormData.mobileDataStateId?.toString() || '0'}
                      isEditMode={isConfigEditMode}
                      onChange={(v) => handleConfigInputChange('mobileDataStateId', parseInt(v))}
                      type="select"
                      options={featureStates.map(state => ({ value: state.id.toString(), label: state.title }))}
                    />
                    <ConfigEditItem
                      label="GPS State"
                      value={<StateBadge value={deviceConfig.gpsStateName} />}
                      editValue={configFormData.gpsStateId?.toString() || '0'}
                      isEditMode={isConfigEditMode}
                      onChange={(v) => handleConfigInputChange('gpsStateId', parseInt(v))}
                      type="select"
                      options={featureStates.map(state => ({ value: state.id.toString(), label: state.title }))}
                    />
                    <ConfigEditItem
                      label="Push Notification Protocol"
                      value={deviceConfig.pushNotificationProtocolTypeName}
                      editValue={configFormData.pushNotificationProtocolTypeId?.toString() || '0'}
                      isEditMode={isConfigEditMode}
                      onChange={(v) => handleConfigInputChange('pushNotificationProtocolTypeId', parseInt(v))}
                      type="select"
                      options={pushNotificationProtocols.map(protocol => ({ value: protocol.id.toString(), label: protocol.title }))}
                    />
                  </div>

                  {/* Location & Tracking */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-lg font-semibold border-b pb-2">
                      <MapPin className="h-5 w-5 text-red-500" />
                      Location & Tracking
                    </div>
                    <ConfigEditItem
                      label="Location Tracking"
                      value={deviceConfig.locationTrackingByTypeName}
                      editValue={configFormData.locationTrackingByTypeId?.toString() || '0'}
                      isEditMode={isConfigEditMode}
                      onChange={(v) => handleConfigInputChange('locationTrackingByTypeId', parseInt(v))}
                      type="select"
                      options={locationTrackingTypes.map(type => ({ value: type.id.toString(), label: type.title }))}
                    />
                    <ConfigEditItem
                      label="Lock System Orientation"
                      value={<BooleanBadge value={deviceConfig.lockSystemOrientation} />}
                      editValue={configFormData.lockSystemOrientation}
                      isEditMode={isConfigEditMode}
                      onChange={(v) => handleConfigInputChange('lockSystemOrientation', v)}
                      type="checkbox"
                    />
                    <ConfigEditItem
                      label="Lock Launcher Orientation"
                      value={<BooleanBadge value={deviceConfig.lockLauncherOrientation} />}
                      editValue={configFormData.lockLauncherOrientation}
                      isEditMode={isConfigEditMode}
                      onChange={(v) => handleConfigInputChange('lockLauncherOrientation', v)}
                      type="checkbox"
                    />
                  </div>

                  {/* Notifications */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-lg font-semibold border-b pb-2">
                      <Bell className="h-5 w-5 text-yellow-500" />
                      Notifications
                    </div>
                    <ConfigEditItem
                      label="Notification Bar State"
                      value={<StateBadge value={deviceConfig.notificationBarStateName} />}
                      editValue={configFormData.notificationBarStateId?.toString() || '0'}
                      isEditMode={isConfigEditMode}
                      onChange={(v) => handleConfigInputChange('notificationBarStateId', parseInt(v))}
                      type="select"
                      options={featureStates.map(state => ({ value: state.id.toString(), label: state.title }))}
                    />
                    <ConfigEditItem
                      label="Enable Notifications"
                      value={<BooleanBadge value={deviceConfig.enableNotifications} />}
                      editValue={configFormData.enableNotifications}
                      isEditMode={isConfigEditMode}
                      onChange={(v) => handleConfigInputChange('enableNotifications', v)}
                      type="checkbox"
                    />
                    <ConfigEditItem
                      label="Hide System Notification Bar"
                      value={<BooleanBadge value={deviceConfig.hideSystemNotificationBarInLauncher} />}
                      editValue={configFormData.hideSystemNotificationBarInLauncher}
                      isEditMode={isConfigEditMode}
                      onChange={(v) => handleConfigInputChange('hideSystemNotificationBarInLauncher', v)}
                      type="checkbox"
                    />

                  </div>

                  {/* Display Settings */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-lg font-semibold border-b pb-2">
                      <Monitor className="h-5 w-5 text-purple-500" />
                      Display Settings
                    </div>
                    <ConfigEditItem
                      label="Use Default Theme"
                      value={<BooleanBadge value={deviceConfig.useDefaultLauncherTheme} />}
                      editValue={configFormData.useDefaultLauncherTheme}
                      isEditMode={isConfigEditMode}
                      onChange={(v) => handleConfigInputChange('useDefaultLauncherTheme', v)}
                      type="checkbox"
                    />
                    <ConfigEditItem
                      label="Background Color"
                      value={
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded border"
                            style={{ backgroundColor: deviceConfig.backgroundColor }}
                          />
                          <span>{deviceConfig.backgroundColor}</span>
                        </div>
                      }
                      editValue={configFormData.backgroundColor || '#FFFFFF'}
                      isEditMode={isConfigEditMode}
                      onChange={(v) => handleConfigInputChange('backgroundColor', v)}
                      type="color"
                    />
                    <ConfigEditItem
                      label="App Names Color"
                      value={
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded border"
                            style={{ backgroundColor: deviceConfig.applicationNamesColor }}
                          />
                          <span>{deviceConfig.applicationNamesColor}</span>
                        </div>
                      }
                      editValue={configFormData.applicationNamesColor || '#000000'}
                      isEditMode={isConfigEditMode}
                      onChange={(v) => handleConfigInputChange('applicationNamesColor', v)}
                      type="color"
                    />
                    <ConfigEditItem
                      label="Screen Always On"
                      value={<BooleanBadge value={deviceConfig.screenAlwaysOn} />}
                      editValue={configFormData.screenAlwaysOn}
                      isEditMode={isConfigEditMode}
                      onChange={(v) => handleConfigInputChange('screenAlwaysOn', v)}
                      type="checkbox"
                    />
                    <ConfigEditItem
                      label="Manage Screen Timeout"
                      value={<BooleanBadge value={deviceConfig.manageScreenTimeout} />}
                      editValue={configFormData.manageScreenTimeout}
                      isEditMode={isConfigEditMode}
                      onChange={(v) => handleConfigInputChange('manageScreenTimeout', v)}
                      type="checkbox"
                    />
                    <ConfigEditItem
                      label="Screen Timeout (seconds)"
                      value={`${deviceConfig.screenTimeoutSeconds} seconds`}
                      editValue={configFormData.screenTimeoutSeconds?.toString() || '60'}
                      isEditMode={isConfigEditMode}
                      onChange={(v) => handleConfigInputChange('screenTimeoutSeconds', parseInt(v))}
                      type="number"
                    />
                  </div>

                  {/* Security & Controls */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-lg font-semibold border-b pb-2">
                      <Lock className="h-5 w-5 text-orange-500" />
                      Security & Controls
                    </div>
                    <ConfigEditItem
                      label="Enable Kiosk Mode"
                      value={<BooleanBadge value={deviceConfig.enableKioskMode} />}
                      editValue={configFormData.enableKioskMode}
                      isEditMode={isConfigEditMode}
                      onChange={(v) => {
                        if (v && !configFormData.kioskModePackageId) {
                          // Don't enable if package ID is not set
                          return;
                        }
                        handleConfigInputChange('enableKioskMode', v);
                      }}
                      type="checkbox"
                    />
                    {/* Kiosk Mode Package ID - shown when kiosk mode is enabled or in edit mode */}
                    {(deviceConfig.enableKioskMode || isConfigEditMode) && (
                      <ConfigEditItem
                        label="Kiosk Mode Package ID"
                        value={deviceConfig.kioskModePackageId || 'Not set'}
                        editValue={configFormData.kioskModePackageId || ''}
                        isEditMode={isConfigEditMode}
                        onChange={(v) => {
                          handleConfigInputChange('kioskModePackageId', v);
                          // If package ID is cleared, disable kiosk mode
                          if (!v && configFormData.enableKioskMode) {
                            handleConfigInputChange('enableKioskMode', false);
                          }
                        }}
                        type="text"
                      />
                    )}
                    {isConfigEditMode && !configFormData.kioskModePackageId && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 -mt-2 ml-1">
                        * Set Package ID first to enable Kiosk Mode
                      </p>
                    )}
                    <ConfigEditItem
                      label="Enable Screen Lock"
                      value={<BooleanBadge value={deviceConfig.enableScreenLock} />}
                      editValue={configFormData.enableScreenLock}
                      isEditMode={isConfigEditMode}
                      onChange={(v) => handleConfigInputChange('enableScreenLock', v)}
                      type="checkbox"
                    />
                    <ConfigEditItem
                      label="Lock Power Button"
                      value={<BooleanBadge value={deviceConfig.lockPowerButton} />}
                      editValue={configFormData.lockPowerButton}
                      isEditMode={isConfigEditMode}
                      onChange={(v) => handleConfigInputChange('lockPowerButton', v)}
                      type="checkbox"
                    />
                    <ConfigEditItem
                      label="Block External Storage"
                      value={<BooleanBadge value={deviceConfig.blockExternalStorage} />}
                      editValue={configFormData.blockExternalStorage}
                      isEditMode={isConfigEditMode}
                      onChange={(v) => handleConfigInputChange('blockExternalStorage', v)}
                      type="checkbox"
                    />
                    <ConfigEditItem
                      label="Is Default Launcher"
                      value={<BooleanBadge value={deviceConfig.isDefaultLauncher} />}
                      editValue={configFormData.isDefaultLauncher}
                      isEditMode={isConfigEditMode}
                      onChange={(v) => handleConfigInputChange('isDefaultLauncher', v)}
                      type="checkbox"
                    />
                    <ConfigEditItem
                      label="Device Admin Code Enabled"
                      value={<BooleanBadge value={deviceConfig.isDeviceAdminCodeEnabled} />}
                      editValue={configFormData.isDeviceAdminCodeEnabled}
                      isEditMode={isConfigEditMode}
                      onChange={(v) => handleConfigInputChange('isDeviceAdminCodeEnabled', v)}
                      type="checkbox"
                    />
                    <ConfigEditItem
                      label="Device Admin Code"
                      value={deviceConfig.deviceAdminCode || 'Not set'}
                      editValue={configFormData.deviceAdminCode || ''}
                      isEditMode={isConfigEditMode}
                      onChange={(v) => handleConfigInputChange('deviceAdminCode', v)}
                      type="text"
                    />
                    <ConfigEditItem
                      label="Allow Access to Sensitive Settings"
                      value={<BooleanBadge value={deviceConfig.allowToAccessSensitiveSettings} />}
                      editValue={configFormData.allowToAccessSensitiveSettings}
                      isEditMode={isConfigEditMode}
                      onChange={(v) => handleConfigInputChange('allowToAccessSensitiveSettings', v)}
                      type="checkbox"
                    />
                  </div>

                  {/* Volume Settings */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-lg font-semibold border-b pb-2">
                      <Bell className="h-5 w-5 text-pink-500" />
                      Volume Settings
                    </div>
                    <ConfigEditItem
                      label="Lock Volume"
                      value={<BooleanBadge value={deviceConfig.lockVolume} />}
                      editValue={configFormData.lockVolume}
                      isEditMode={isConfigEditMode}
                      onChange={(v) => handleConfigInputChange('lockVolume', v)}
                      type="checkbox"
                    />
                    <ConfigEditItem
                      label="Volume Level"
                      value={
                        <div className="flex items-center gap-2">
                          <div className="w-32 bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                            <div
                              className="bg-primary h-2 rounded-full"
                              style={{ width: `${deviceConfig.volumePercentage}%` }}
                            />
                          </div>
                          <span>{deviceConfig.volumePercentage}%</span>
                        </div>
                      }
                      editValue={configFormData.volumePercentage?.toString() || '50'}
                      isEditMode={isConfigEditMode}
                      onChange={(v) => handleConfigInputChange('volumePercentage', parseInt(v))}
                      type="range"
                    />
                  </div>

                  {/* Permissions */}
                  <div className="space-y-4 md:col-span-2">
                    <div className="flex items-center gap-2 text-lg font-semibold border-b pb-2">
                      <Lock className="h-5 w-5 text-indigo-500" />
                      Application Permissions
                    </div>
                    <ConfigEditItem
                      label="Permission Granter"
                      value={deviceConfig.applicationPermissionGranterTypeName}
                      editValue={configFormData.applicationPermissionGranterTypeId?.toString() || '0'}
                      isEditMode={isConfigEditMode}
                      onChange={(v) => handleConfigInputChange('applicationPermissionGranterTypeId', parseInt(v))}
                      type="select"
                      options={permissionGranters.map(granter => ({ value: granter.id.toString(), label: granter.title }))}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mb-4" />
                  <p>No configuration found for this device</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
}

// Helper Components
function ConfigItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-dashed border-muted last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

interface ConfigEditItemProps {
  label: string;
  value: React.ReactNode;
  editValue: string | boolean | undefined;
  isEditMode: boolean;
  onChange: (value: any) => void;
  type: 'text' | 'number' | 'checkbox' | 'select' | 'color' | 'range';
  options?: { value: string; label: string }[];
}

function ConfigEditItem({ label, value, editValue, isEditMode, onChange, type, options }: ConfigEditItemProps) {
  if (!isEditMode) {
    return (
        <div className="grid grid-cols-2 py-2 border-b border-dashed border-muted last:border-0">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className="text-sm font-medium text-right">{value}</span>
        </div>
    );
  }

  return (
    <div className="flex justify-between items-center py-2 border-b border-dashed border-muted last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        {type === 'text' && (
          <input
            type="text"
            value={editValue as string}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 w-48 rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        )}
        {type === 'number' && (
          <input
            type="number"
            value={editValue as string}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 w-24 rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        )}
        {type === 'checkbox' && (
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={editValue as boolean}
              onChange={(e) => onChange(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
          </label>
        )}
        {type === 'select' && options && (
          <select
            value={editValue as string}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 w-48 rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
        {type === 'color' && (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={editValue as string}
              onChange={(e) => onChange(e.target.value)}
              className="h-8 w-8 rounded border border-input cursor-pointer"
            />
            <input
              type="text"
              value={editValue as string}
              onChange={(e) => onChange(e.target.value)}
              className="h-8 w-24 rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        )}
        {type === 'range' && (
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="100"
              value={editValue as string}
              onChange={(e) => onChange(e.target.value)}
              className="w-32 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
            />
            <span className="text-sm w-12">{editValue}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

function BooleanBadge({ value }: { value: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
        value
          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
          : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
      }`}
    >
      {value ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {value ? 'Enabled' : 'Disabled'}
    </span>
  );
}

function StateBadge({ value }: { value: string }) {
  const isAny = value.toUpperCase() === 'ANY';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        isAny
          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
          : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      }`}
    >
      {value}
    </span>
  );
}

function DeviceStatusDot({ status }: { status?: 'online' | 'offline' }) {
  if (!status) {
    // No MQTT event received yet — show grey dot
    return (
      <span className="relative inline-flex h-3 w-3" title="Unknown">
        <span className="h-3 w-3 rounded-full bg-gray-300 dark:bg-gray-600" />
      </span>
    );
  }
  if (status === 'online') {
    return (
      <span className="relative inline-flex h-3 w-3" title="Online">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
      </span>
    );
  }
  return (
    <span className="relative inline-flex h-3 w-3" title="Offline">
      <span className="h-3 w-3 rounded-full bg-red-500" />
    </span>
  );
}

