import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDeviceApplications, useDevicesQuery, useUpdateDeviceApplication } from '@/hooks/useDevices';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, AppWindow, Package, Eye, EyeOff, Download, Check, X, Smartphone, Pencil, Save } from 'lucide-react';
import { ROUTES } from '@/utils/constants';
import type { DeviceApplication, UpdateDeviceApplicationRequest } from '@/types/device.types';

export function DeviceApplicationsPage() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();
  const numericDeviceId = deviceId ? parseInt(deviceId, 10) : null;

  const { data: devices = [] } = useDevicesQuery();
  const { data: deviceApps = [], isLoading } = useDeviceApplications(numericDeviceId);
  const updateMutation = useUpdateDeviceApplication();

  const device = devices.find(d => d.id === numericDeviceId);

  // Edit state
  const [editingAppId, setEditingAppId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<UpdateDeviceApplicationRequest>({});

  const handleBack = () => {
    navigate(ROUTES.DASHBOARD, { state: { activeTab: 'devices' } });
  };

  const handleEdit = (app: DeviceApplication) => {
    setEditingAppId(app.id);
    setEditFormData({
      deviceId: app.deviceId,
      userId: app.userId,
      appName: app.appName,
      appPackageId: app.appPackageId,
      appVersion: app.appVersion,
      isAllowed: app.isAllowed,
      showIcon: app.showIcon,
      orderNumberInLauncher: app.orderNumberInLauncher,
      installUpdate: app.installUpdate,
    });
  };

  const handleCancelEdit = () => {
    setEditingAppId(null);
    setEditFormData({});
  };

  const handleSave = async () => {
    if (!editingAppId) return;
    try {
      await updateMutation.mutateAsync({
        appId: editingAppId,
        ...editFormData,
      });
      setEditingAppId(null);
      setEditFormData({});
    } catch (err) {
      console.error('Failed to update application', err);
    }
  };

  const handleInputChange = (field: keyof UpdateDeviceApplicationRequest, value: any) => {
    setEditFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <AppWindow className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Device Applications</h1>
              {device && (
                <p className="text-muted-foreground flex items-center gap-2 mt-1">
                  <Smartphone className="h-4 w-4" />
                  {device.deviceUuid} • {device.userName} • {device.model}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Applications Table */}
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Installed Applications</CardTitle>
              {!isLoading && deviceApps.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  {deviceApps.length} application{deviceApps.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <p className="text-sm text-muted-foreground">Loading applications...</p>
                </div>
              </div>
            ) : deviceApps.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-medium">Application</th>
                      <th className="px-6 py-4 text-left text-sm font-medium">Package ID</th>
                      <th className="px-6 py-4 text-left text-sm font-medium">Version</th>
                      <th className="px-6 py-4 text-center text-sm font-medium">Status</th>
                      <th className="px-6 py-4 text-center text-sm font-medium">Visibility</th>
                      <th className="px-6 py-4 text-center text-sm font-medium">Order</th>
                      <th className="px-6 py-4 text-center text-sm font-medium">Auto Update</th>
                      <th className="px-6 py-4 text-center text-sm font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {deviceApps.map((app) => {
                      const isEditing = editingAppId === app.id;

                      return (
                        <tr key={app.id} className={`transition-colors ${isEditing ? 'bg-blue-50 dark:bg-blue-950/30' : 'hover:bg-muted/30'}`}>
                          {/* Application Name */}
                          <td className="px-6 py-4">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editFormData.appName || ''}
                                onChange={(e) => handleInputChange('appName', e.target.value)}
                                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                              />
                            ) : (
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-muted rounded-lg">
                                  <Package className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <span className="font-medium">{app.appName}</span>
                              </div>
                            )}
                          </td>

                          {/* Package ID */}
                          <td className="px-6 py-4">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editFormData.appPackageId || ''}
                                onChange={(e) => handleInputChange('appPackageId', e.target.value)}
                                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                              />
                            ) : (
                              <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                                {app.appPackageId}
                              </code>
                            )}
                          </td>

                          {/* Version */}
                          <td className="px-6 py-4">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editFormData.appVersion || ''}
                                onChange={(e) => handleInputChange('appVersion', e.target.value)}
                                className="h-9 w-24 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                              />
                            ) : (
                              <span className="text-sm">{app.appVersion}</span>
                            )}
                          </td>

                          {/* Status (isAllowed) */}
                          <td className="px-6 py-4 text-center">
                            {isEditing ? (
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={editFormData.isAllowed || false}
                                  onChange={(e) => handleInputChange('isAllowed', e.target.checked)}
                                  className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-500"></div>
                              </label>
                            ) : (
                              <span
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                                  app.isAllowed
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400'
                                    : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                                }`}
                              >
                                {app.isAllowed ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                                {app.isAllowed ? 'Allowed' : 'Blocked'}
                              </span>
                            )}
                          </td>

                          {/* Visibility (showIcon) */}
                          <td className="px-6 py-4 text-center">
                            {isEditing ? (
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={editFormData.showIcon || false}
                                  onChange={(e) => handleInputChange('showIcon', e.target.checked)}
                                  className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-500"></div>
                              </label>
                            ) : (
                              <div className="flex items-center justify-center gap-2">
                                {app.showIcon ? (
                                  <>
                                    <Eye className="h-4 w-4 text-green-500" />
                                    <span className="text-xs text-muted-foreground">Visible</span>
                                  </>
                                ) : (
                                  <>
                                    <EyeOff className="h-4 w-4 text-gray-400" />
                                    <span className="text-xs text-muted-foreground">Hidden</span>
                                  </>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Order */}
                          <td className="px-6 py-4 text-center">
                            {isEditing ? (
                              <input
                                type="number"
                                value={editFormData.orderNumberInLauncher || 0}
                                onChange={(e) => handleInputChange('orderNumberInLauncher', parseInt(e.target.value) || 0)}
                                className="h-9 w-16 rounded-md border border-input bg-background px-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary"
                                min="0"
                              />
                            ) : (
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-medium">
                                {app.orderNumberInLauncher}
                              </span>
                            )}
                          </td>

                          {/* Auto Update (installUpdate) */}
                          <td className="px-6 py-4 text-center">
                            {isEditing ? (
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={editFormData.installUpdate || false}
                                  onChange={(e) => handleInputChange('installUpdate', e.target.checked)}
                                  className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-500"></div>
                              </label>
                            ) : (
                              app.installUpdate ? (
                                <div className="flex items-center justify-center gap-2">
                                  <Download className="h-4 w-4 text-blue-500" />
                                  <span className="text-xs text-muted-foreground">Enabled</span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">Disabled</span>
                              )
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-6 py-4 text-center">
                            {isEditing ? (
                              <div className="flex items-center justify-center gap-2">
                                <Button
                                  size="sm"
                                  onClick={handleSave}
                                  disabled={updateMutation.isPending}
                                >
                                  <Save className="h-4 w-4 mr-1" />
                                  {updateMutation.isPending ? 'Saving...' : 'Save'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={handleCancelEdit}
                                  disabled={updateMutation.isPending}
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEdit(app)}
                                disabled={editingAppId !== null}
                              >
                                <Pencil className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <div className="p-4 bg-muted rounded-full mb-4">
                  <Package className="h-8 w-8" />
                </div>
                <p className="text-lg font-medium">No Applications Found</p>
                <p className="text-sm mt-1">This device doesn't have any registered applications yet.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Cards */}
        {!isLoading && deviceApps.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                    <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{deviceApps.length}</p>
                    <p className="text-xs text-muted-foreground">Total Apps</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                    <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{deviceApps.filter(a => a.isAllowed).length}</p>
                    <p className="text-xs text-muted-foreground">Allowed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 dark:bg-red-900 rounded-lg">
                    <X className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{deviceApps.filter(a => !a.isAllowed).length}</p>
                    <p className="text-xs text-muted-foreground">Blocked</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                    <Eye className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{deviceApps.filter(a => a.showIcon).length}</p>
                    <p className="text-xs text-muted-foreground">Visible</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
