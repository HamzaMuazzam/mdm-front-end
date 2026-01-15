import { useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDeviceApplications, useDevicesQuery, useUpdateDeviceApplication } from '@/hooks/useDevices';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AppWindow,
  Package,
  Eye,
  EyeOff,
  Download,
  Check,
  X,
  Smartphone,
  Pencil,
  Save,
  Search,
  RefreshCw,
  ChevronRight,
  Home,
  Shield,
  ShieldOff,
  Hash,
  LayoutGrid,
  Upload,
  Image as ImageIcon
} from 'lucide-react';
import { ROUTES } from '@/utils/constants';
import type { DeviceApplication, UpdateDeviceApplicationRequest } from '@/types/device.types';
import { toast } from '@/hooks/useToast';

export function DeviceApplicationsPage() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();
  const numericDeviceId = deviceId ? parseInt(deviceId, 10) : null;

  const { data: devices = [] } = useDevicesQuery();
  const { data: deviceApps = [], isLoading, refetch } = useDeviceApplications(numericDeviceId);
  const updateMutation = useUpdateDeviceApplication();

  const device = devices.find(d => d.id === numericDeviceId);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Edit state
  const [editingApp, setEditingApp] = useState<DeviceApplication | null>(null);
  const [editFormData, setEditFormData] = useState<UpdateDeviceApplicationRequest>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filtered apps based on search
  const filteredApps = useMemo(() => {
    if (!searchQuery.trim()) return deviceApps;
    const query = searchQuery.toLowerCase();
    return deviceApps.filter(app =>
      app.appName.toLowerCase().includes(query) ||
      app.appPackageId.toLowerCase().includes(query)
    );
  }, [deviceApps, searchQuery]);

  const handleBack = () => {
    navigate(ROUTES.DASHBOARD, { state: { activeTab: 'devices' } });
  };

  const handleEdit = (app: DeviceApplication) => {
    setEditingApp(app);
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
      appIconBase64: app.appIconBase64,
    });
  };

  const handleCloseEdit = () => {
    setEditingApp(null);
    setEditFormData({});
  };

  const handleSave = async () => {
    if (!editingApp) return;
    try {
      await updateMutation.mutateAsync({
        appId: editingApp.id,
        ...editFormData,
      });
      handleCloseEdit();
    } catch (err) {
      console.error('Failed to update application', err);
    }
  };

  const handleInputChange = (field: keyof UpdateDeviceApplicationRequest, value: any) => {
    setEditFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleRefresh = () => {
    refetch();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (optional, but good practice)
    if (file.size > 1024 * 1024) { // 1MB limit
      toast({
        variant: 'destructive',
        title: 'File too large',
        description: 'Please upload an image smaller than 1MB.',
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      
      // Create an image to check dimensions
      const img = new Image();
      img.onload = () => {
        if (img.width > 50 || img.height > 50) {
           // Resize logic could go here, but for now we'll just warn or accept
           // The requirement says "user can also upload maximum 50 by 50 icon"
           // We will resize it if it's too big or just warn. 
           // Let's resize it to 50x50 max to be safe and helpful.
           const canvas = document.createElement('canvas');
           let width = img.width;
           let height = img.height;
           
           if (width > 50 || height > 50) {
             if (width > height) {
               height = Math.round((height * 50) / width);
               width = 50;
             } else {
               width = Math.round((width * 50) / height);
               height = 50;
             }
           }
           
           canvas.width = width;
           canvas.height = height;
           const ctx = canvas.getContext('2d');
           ctx?.drawImage(img, 0, 0, width, height);
           const resizedBase64 = canvas.toDataURL(file.type);
           handleInputChange('appIconBase64', resizedBase64);
        } else {
           handleInputChange('appIconBase64', base64String);
        }
      };
      img.src = base64String;
    };
    reader.readAsDataURL(file);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const removeIcon = () => {
    handleInputChange('appIconBase64', null);
  };

  // Stats
  const stats = useMemo(() => ({
    total: deviceApps.length,
    allowed: deviceApps.filter(a => a.isAllowed).length,
    blocked: deviceApps.filter(a => !a.isAllowed).length,
    visible: deviceApps.filter(a => a.showIcon).length,
  }), [deviceApps]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              {/* Breadcrumb */}
              <nav className="flex items-center space-x-2 text-sm">
                <button
                  onClick={handleBack}
                  className="flex items-center text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                >
                  <Home className="h-4 w-4" />
                </button>
                <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-600" />
                <button
                  onClick={handleBack}
                  className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                >
                  Devices
                </button>
                <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-600" />
                <span className="text-slate-900 dark:text-white font-medium">Applications</span>
              </nav>

              {/* Device Info in Header */}
              {device && (
                <div className="hidden md:flex items-center gap-4 pl-4 border-l border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-slate-400" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{device.model}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">ID:</span>
                    <span className="text-sm font-mono text-slate-600 dark:text-slate-300">{device.deviceUuid}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">User:</span>
                    <span className="text-sm text-slate-600 dark:text-slate-300">{device.userName}</span>
                  </div>
                </div>
              )}

              {/* Search Header */}
              <div className="flex-auto px-6 py-4 dark:bg-slate-800/50 dark:border-slate-700">
                <div className="flex items-center justify-between gap-4">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        type="text"
                        placeholder="Search by app name or package ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                    />
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {filteredApps.length} of {deviceApps.length} apps
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8 mb-8">
          {/* Page Title Section */}
          <div className="flex-1">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg shadow-blue-500/25">
                <AppWindow className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                  Device Applications
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Manage installed applications and permissions
                </p>
              </div>
            </div>
          </div>

          {/* Stats Cards - Compact Vertical Layout on Desktop */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:w-auto">
            <CompactStatCard
              icon={<Package className="h-4 w-4" />}
              label="Total"
              value={stats.total}
              color="blue"
            />
            <CompactStatCard
              icon={<Shield className="h-4 w-4" />}
              label="Allowed"
              value={stats.allowed}
              color="green"
            />
            <CompactStatCard
              icon={<ShieldOff className="h-4 w-4" />}
              label="Blocked"
              value={stats.blocked}
              color="red"
            />
            <CompactStatCard
              icon={<Eye className="h-4 w-4" />}
              label="Visible"
              value={stats.visible}
              color="purple"
            />
          </div>
        </div>

        {/* Search and Table */}
        <Card className="shadow-xl shadow-slate-200/50 dark:shadow-none border-0 overflow-hidden">


          {/* Table Content */}
          <CardContent className="p-0">
            {isLoading ? (
              <LoadingSkeleton />
            ) : filteredApps.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Application
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Version
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Visibility
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Order
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Auto Update
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredApps.map((app) => (
                      <tr
                        key={app.id}
                        className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        {/* Application */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 rounded-xl flex items-center justify-center overflow-hidden">
                              {app.appIconBase64 ? (
                                <img src={app.appIconBase64} alt={app.appName} className="w-full h-full object-cover" />
                              ) : (
                                <Package className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 dark:text-white truncate">
                                {app.appName}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate max-w-[200px]">
                                {app.appPackageId}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Version */}
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300">
                            v{app.appVersion}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4 text-center">
                          <StatusBadge allowed={app.isAllowed} />
                        </td>

                        {/* Visibility */}
                        <td className="px-6 py-4 text-center">
                          <VisibilityBadge visible={app.showIcon} />
                        </td>

                        {/* Order */}
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-semibold text-slate-600 dark:text-slate-300">
                            {app.orderNumberInLauncher}
                          </span>
                        </td>

                        {/* Auto Update */}
                        <td className="px-6 py-4 text-center">
                          {app.installUpdate ? (
                            <span className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                              <Download className="h-4 w-4" />
                              <span className="text-xs font-medium">On</span>
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 dark:text-slate-500">Off</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(app)}
                            className="opacity-60 group-hover:opacity-100 transition-opacity"
                          >
                            <Pencil className="h-4 w-4 mr-1.5" />
                            Edit
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : deviceApps.length > 0 ? (
              <EmptySearchState query={searchQuery} onClear={() => setSearchQuery('')} />
            ) : (
              <EmptyState />
            )}
          </CardContent>
        </Card>
      </main>

      {/* Edit Slide-over Panel */}
      {editingApp && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 transition-opacity"
            onClick={handleCloseEdit}
          />

          {/* Panel */}
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-40 overflow-hidden flex flex-col animate-in slide-in-from-right duration-300">
            {/* Panel Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Edit Application
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    Update application settings
                  </p>
                </div>
                <button
                  onClick={handleCloseEdit}
                  className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <X className="h-5 w-5 text-slate-500" />
                </button>
              </div>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* App Info Card */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center overflow-hidden">
                    {editFormData.appIconBase64 ? (
                      <img src={editFormData.appIconBase64} alt="App Icon" className="w-full h-full object-cover" />
                    ) : (
                      <Package className="h-6 w-6 text-white" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {editingApp.appName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {editingApp.appPackageId}
                    </p>
                  </div>
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-5">
                {/* App Icon Upload */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Application Icon (Max 50x50)
                  </Label>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700">
                      {editFormData.appIconBase64 ? (
                        <img src={editFormData.appIconBase64} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-slate-400" />
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileChange}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={triggerFileInput}
                        className="gap-2"
                      >
                        <Upload className="h-4 w-4" />
                        Upload Icon
                      </Button>
                      {editFormData.appIconBase64 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={removeIcon}
                          className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                        >
                          Remove Icon
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* App Name */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Application Name
                  </Label>
                  <Input
                    value={editFormData.appName || ''}
                    onChange={(e) => handleInputChange('appName', e.target.value)}
                    className="bg-white dark:bg-slate-800"
                  />
                </div>

                {/* Package ID */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Package ID
                  </Label>
                  <Input
                    value={editFormData.appPackageId || ''}
                    onChange={(e) => handleInputChange('appPackageId', e.target.value)}
                    className="bg-white dark:bg-slate-800 font-mono text-sm"
                  />
                </div>

                {/* Version */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Version
                  </Label>
                  <Input
                    value={editFormData.appVersion || ''}
                    onChange={(e) => handleInputChange('appVersion', e.target.value)}
                    className="bg-white dark:bg-slate-800"
                  />
                </div>

                {/* Order */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    Order in Launcher
                  </Label>
                  <Input
                    type="number"
                    value={editFormData.orderNumberInLauncher || 0}
                    onChange={(e) => handleInputChange('orderNumberInLauncher', parseInt(e.target.value) || 0)}
                    className="bg-white dark:bg-slate-800"
                    min="0"
                  />
                </div>

                {/* Toggle Options */}
                <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <ToggleOption
                    label="Allow Application"
                    description="User can access and use this application"
                    checked={editFormData.isAllowed || false}
                    onChange={(checked) => handleInputChange('isAllowed', checked)}
                    icon={<Shield className="h-5 w-5" />}
                    activeColor="green"
                  />

                  <ToggleOption
                    label="Show Icon"
                    description="Display app icon in the launcher"
                    checked={editFormData.showIcon || false}
                    onChange={(checked) => handleInputChange('showIcon', checked)}
                    icon={<LayoutGrid className="h-5 w-5" />}
                    activeColor="purple"
                  />

                  <ToggleOption
                    label="Auto Update"
                    description="Automatically install app updates"
                    checked={editFormData.installUpdate || false}
                    onChange={(checked) => handleInputChange('installUpdate', checked)}
                    icon={<Download className="h-5 w-5" />}
                    activeColor="blue"
                  />
                </div>
              </div>
            </div>

            {/* Panel Footer */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={handleCloseEdit}
                  className="flex-1"
                  disabled={updateMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Helper Components
interface CompactStatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'blue' | 'green' | 'red' | 'purple';
}

function CompactStatCard({ icon, label, value, color }: CompactStatCardProps) {
  const colorClasses = {
    blue: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400',
    green: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400',
    red: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400',
    purple: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400',
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-lg font-bold text-slate-900 dark:text-white leading-none">{value}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function StatusBadge({ allowed }: { allowed: boolean }) {
  return allowed ? (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400">
      <Check className="h-3.5 w-3.5" />
      Allowed
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400">
      <X className="h-3.5 w-3.5" />
      Blocked
    </span>
  );
}

function VisibilityBadge({ visible }: { visible: boolean }) {
  return visible ? (
    <span className="inline-flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
      <Eye className="h-4 w-4" />
      <span className="text-xs font-medium">Visible</span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
      <EyeOff className="h-4 w-4" />
      <span className="text-xs font-medium">Hidden</span>
    </span>
  );
}

interface ToggleOptionProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon: React.ReactNode;
  activeColor: 'green' | 'purple' | 'blue';
}

function ToggleOption({ label, description, checked, onChange, icon, activeColor }: ToggleOptionProps) {
  const activeClasses = {
    green: 'peer-checked:bg-emerald-500',
    purple: 'peer-checked:bg-purple-500',
    blue: 'peer-checked:bg-blue-500',
  };

  const iconColorClasses = {
    green: checked ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400',
    purple: checked ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400',
    blue: checked ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400',
  };

  return (
    <label className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
      <div className="flex items-center gap-3">
        <div className={iconColorClasses[activeColor]}>
          {icon}
        </div>
        <div>
          <p className="font-medium text-slate-900 dark:text-white">{label}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      </div>
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className={`w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full peer ${activeClasses[activeColor]} peer-focus:ring-2 peer-focus:ring-blue-300 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5`} />
      </div>
    </label>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 animate-pulse">
          <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-xl" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
          </div>
          <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded-full w-20" />
          <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded-full w-16" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
        <Package className="h-8 w-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
        No Applications Found
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-sm">
        This device doesn't have any registered applications yet. Applications will appear here once they are installed on the device.
      </p>
    </div>
  );
}

function EmptySearchState({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
        <Search className="h-8 w-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
        No Results Found
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-sm mb-4">
        No applications match "<span className="font-medium">{query}</span>". Try a different search term.
      </p>
      <Button variant="outline" size="sm" onClick={onClear}>
        Clear Search
      </Button>
    </div>
  );
}
