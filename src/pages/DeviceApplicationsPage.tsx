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
  Clock3,
  CalendarDays,
  Upload,
  Image as ImageIcon,
  Gamepad2,
  Music,
  Video,
  Camera,
  Users,
  Newspaper,
  MapPin,
  Wrench,
  Accessibility,
  ChevronDown,
  Monitor
} from 'lucide-react';
import { ROUTES } from '@/utils/constants';
import type { DeviceApplication, UpdateDeviceApplicationRequest } from '@/types/device.types';
import { ApplicationCategoryInfo } from '@/types/device.types';
import { toast } from '@/hooks/useToast';

// Helper to convert base64 string to a valid image src
const getBase64ImageSrc = (base64: string | null | undefined): string | null => {
  if (!base64) return null;
  // If it already has the data URI prefix, return as-is
  if (base64.startsWith('data:')) return base64;
  // Otherwise, add a generic image prefix
  return `data:image/png;base64,${base64}`;
};

// Category icon mapping
const getCategoryIcon = (category: string) => {
  const iconMap: Record<string, React.ReactNode> = {
    'Games': <Gamepad2 className="h-4 w-4" />,
    'Audio & Music': <Music className="h-4 w-4" />,
    'Video': <Video className="h-4 w-4" />,
    'Photos': <Camera className="h-4 w-4" />,
    'Social Apps': <Users className="h-4 w-4" />,
    'News': <Newspaper className="h-4 w-4" />,
    'Maps & Navigations': <MapPin className="h-4 w-4" />,
    'Tools & Productivity': <Wrench className="h-4 w-4" />,
    'Accessibility': <Accessibility className="h-4 w-4" />,
    'Others': <Package className="h-4 w-4" />,
  };
  return iconMap[category] || <Package className="h-4 w-4" />;
};

// All category options for filter
const categoryOptions = Object.values(ApplicationCategoryInfo).map(info => info.label);

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const toDateInputValue = (value?: string | null): string => {
  if (!value) return '';

  if (DATE_ONLY_PATTERN.test(value)) {
    return value;
  }

  const [datePart] = value.split('T');
  if (datePart && DATE_ONLY_PATTERN.test(datePart)) {
    return datePart;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return '';
  }

  return parsedDate.toISOString().slice(0, 10);
};

const toEndOfDayIso = (dateValue: string): string => {
  const [year, month, day] = dateValue.split('-').map((part) => Number(part));
  if (!year || !month || !day) {
    return '';
  }

  return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999)).toISOString();
};

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

  // Filter states
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [systemAppFilter, setSystemAppFilter] = useState<string>('all');

  // Edit state
  const [editingApp, setEditingApp] = useState<DeviceApplication | null>(null);
  const [editFormData, setEditFormData] = useState<UpdateDeviceApplicationRequest>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filtered apps based on search and filters
  const filteredApps = useMemo(() => {
    return deviceApps.filter(app => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        if (!app.appName.toLowerCase().includes(query) &&
            !app.appPackageId.toLowerCase().includes(query)) {
          return false;
        }
      }
      // Category filter
      if (categoryFilter !== 'all' && app.applicationCategory !== categoryFilter) {
        return false;
      }
      // System app filter
      if (systemAppFilter === 'system' && !app.isSystemApp) {
        return false;
      }
      if (systemAppFilter === 'user' && app.isSystemApp) {
        return false;
      }
      return true;
    });
  }, [deviceApps, searchQuery, categoryFilter, systemAppFilter]);

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
      isSystemApp: app.isSystemApp,
      isAllowed: app.isAllowed,
      showIcon: app.showIcon,
      orderNumberInLauncher: app.orderNumberInLauncher,
      appCategory: app.appCategory,
      installUpdate: app.installUpdate,
      appIconBase64: app.appIconBase64,
      isTimeLimited: app.isTimeLimited ?? false,
      isTimeLimitDailyAllowed: app.isTimeLimitDailyAllowed ?? false,
      allowedTimeLimitTillDate: app.allowedTimeLimitTillDate ?? null,
      timeLimit: app.timeLimit ?? 0,
    });
  };

  const handleCloseEdit = () => {
    setEditingApp(null);
    setEditFormData({});
  };

  const handleSave = async () => {
    if (!editingApp) return;
    try {
      const payload: UpdateDeviceApplicationRequest = {
        ...editFormData,
        allowedTimeLimitTillDate: editFormData.allowedTimeLimitTillDate ?? null,
      };
      if (!payload.isAllowed || !payload.isTimeLimited) {
        payload.isTimeLimitDailyAllowed = false;
        payload.allowedTimeLimitTillDate = null;
        payload.timeLimit = 0;
        if (!payload.isAllowed) {
          payload.isTimeLimited = false;
        }
      }

      await updateMutation.mutateAsync({
        appId: editingApp.id,
        ...payload,
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
      <header className="bg-background/80 backdrop-blur-md border-b border-border sticky top-0 z-20">
        <div className="px-4 sm:px-6">
          {/* Row 1: breadcrumb + device info (md) + refresh */}
          <div className="flex items-center justify-between gap-3 h-12 sm:h-14">
            <nav className="flex items-center space-x-2 text-sm min-w-0">
              <button onClick={handleBack} className="flex items-center text-muted-foreground hover:text-foreground shrink-0">
                <Home className="h-4 w-4" />
              </button>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              <button onClick={handleBack} className="text-muted-foreground hover:text-foreground shrink-0">
                Devices
              </button>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-medium truncate">Applications</span>
            </nav>
            {device && (
              <div className="hidden md:flex items-center gap-4 pl-4 border-l border-border shrink-0">
                <span className="text-sm font-medium">{device.model}</span>
                <span className="text-sm font-mono">{device.deviceUuid}</span>
                <span className="text-sm">{device.userName}</span>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2 shrink-0">
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
          {/* Row 2: Search + filters */}
          <div className="flex items-center gap-2 pb-3 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search apps..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="relative">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="appearance-none bg-background border border-border rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
              >
                <option value="all">All Categories</option>
                {categoryOptions.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={systemAppFilter}
                onChange={(e) => setSystemAppFilter(e.target.value)}
                className="appearance-none bg-background border border-border rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
              >
                <option value="all">All Apps</option>
                <option value="system">System</option>
                <option value="user">User</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
            <div className="text-xs text-muted-foreground whitespace-nowrap">
              {filteredApps.length}/{deviceApps.length}
            </div>
          </div>
        </div>
      </header>
      <main className="px-4 sm:px-6 py-8">
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
              <>
                {/* Mobile card list */}
                <div className="flex flex-col divide-y divide-border md:hidden">
                  {filteredApps.map((app) => (
                    <div key={app.id} className="p-4 flex items-start gap-3">
                      {/* App icon */}
                      <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 rounded-xl flex items-center justify-center overflow-hidden">
                        {app.appIconBase64 ? (
                          <img src={getBase64ImageSrc(app.appIconBase64)!} alt={app.appName} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate text-slate-900 dark:text-white">{app.appName}</p>
                            <p className="text-xs text-muted-foreground font-mono truncate">{app.appPackageId}</p>
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(app)} className="shrink-0 -mt-1">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                        {/* Badges row */}
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          <StatusBadge allowed={app.isAllowed} />
                          <VisibilityBadge visible={app.showIcon} />
                          <AppTypeBadge isSystemApp={app.isSystemApp} />
                          <CategoryBadge category={app.applicationCategory} />
                        </div>
                        {/* Details row */}
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                          <span>v{app.appVersion}</span>
                          <span>Order: {app.orderNumberInLauncher}</span>
                          {app.installUpdate && (
                            <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
                              <Download className="h-3 w-3" /> Auto Update
                            </span>
                          )}
                        </div>
                        {/* Time limit badges */}
                        {(app.isTimeLimited || app.isTimeLimitDailyAllowed || app.allowedTimeLimitTillDate) && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {app.isTimeLimited && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                                <Clock3 className="h-3 w-3" />{`${app.timeLimit ?? 0} min`}
                              </span>
                            )}
                            {app.isTimeLimitDailyAllowed && (
                              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">Daily</span>
                            )}
                            {app.allowedTimeLimitTillDate && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-800 dark:bg-violet-900/50 dark:text-violet-300">
                                <CalendarDays className="h-3 w-3" />Till {toDateInputValue(app.allowedTimeLimitTillDate)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop table (hidden below md) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Application</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Category</th>
                        <th className="px-6 py-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Type</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Version</th>
                        <th className="px-6 py-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Visibility</th>
                        <th className="px-6 py-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Order</th>
                        <th className="px-6 py-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Auto Update</th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredApps.map((app) => (
                        <tr key={app.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 rounded-xl flex items-center justify-center overflow-hidden">
                                {app.appIconBase64 ? (
                                  <img src={getBase64ImageSrc(app.appIconBase64)!} alt={app.appName} className="w-full h-full object-cover" />
                                ) : (
                                  <Package className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-slate-900 dark:text-white truncate">{app.appName}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate max-w-[200px]">{app.appPackageId}</p>
                                {(app.isTimeLimited || app.isTimeLimitDailyAllowed || app.allowedTimeLimitTillDate) && (
                                  <div className="mt-1 flex flex-wrap gap-1.5">
                                    {app.isTimeLimited && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                                        <Clock3 className="h-3 w-3" />{`${app.timeLimit ?? 0} min`}
                                      </span>
                                    )}
                                    {app.isTimeLimitDailyAllowed && (
                                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">Daily</span>
                                    )}
                                    {app.allowedTimeLimitTillDate && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-800 dark:bg-violet-900/50 dark:text-violet-300">
                                        <CalendarDays className="h-3 w-3" />Till {toDateInputValue(app.allowedTimeLimitTillDate)}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4"><CategoryBadge category={app.applicationCategory} /></td>
                          <td className="px-6 py-4 text-center"><AppTypeBadge isSystemApp={app.isSystemApp} /></td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300">v{app.appVersion}</span>
                          </td>
                          <td className="px-6 py-4 text-center"><StatusBadge allowed={app.isAllowed} /></td>
                          <td className="px-6 py-4 text-center"><VisibilityBadge visible={app.showIcon} /></td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-semibold text-slate-600 dark:text-slate-300">{app.orderNumberInLauncher}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {app.installUpdate ? (
                              <span className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400"><Download className="h-4 w-4" /><span className="text-xs font-medium">On</span></span>
                            ) : (
                              <span className="text-xs text-slate-400 dark:text-slate-500">Off</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Button size="sm" variant="ghost" onClick={() => handleEdit(app)} className="opacity-60 group-hover:opacity-100 transition-opacity">
                              <Pencil className="h-4 w-4 mr-1.5" />Edit
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
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
                      <img src={getBase64ImageSrc(editFormData.appIconBase64)!} alt="App Icon" className="w-full h-full object-cover" />
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
                        <img src={getBase64ImageSrc(editFormData.appIconBase64)!} alt="Preview" className="w-full h-full object-cover" />
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
                    onChange={(checked) => {
                      handleInputChange('isAllowed', checked);
                      if (!checked) {
                        handleInputChange('isTimeLimited', false);
                        handleInputChange('isTimeLimitDailyAllowed', false);
                        handleInputChange('allowedTimeLimitTillDate', null);
                        handleInputChange('timeLimit', 0);
                      }
                    }}
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

                {/* Time Limit Settings */}
                <div
                  className={`space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-800/40 ${
                    editFormData.isAllowed ? '' : 'opacity-50'
                  }`}
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Usage Time Controls</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {editFormData.isAllowed
                        ? 'Configure time limits for this app.'
                        : 'Enable "Allow Application" to configure time limits.'}
                    </p>
                  </div>

                  <ToggleOption
                    label="Enable Time Limit"
                    description="Restrict how long this app can be used"
                    checked={editFormData.isTimeLimited || false}
                    onChange={(checked) => {
                      handleInputChange('isTimeLimited', checked);
                      if (!checked) {
                        handleInputChange('isTimeLimitDailyAllowed', false);
                        handleInputChange('allowedTimeLimitTillDate', null);
                        handleInputChange('timeLimit', 0);
                      }
                    }}
                    icon={<Clock3 className="h-5 w-5" />}
                    activeColor="blue"
                    disabled={!editFormData.isAllowed}
                  />

                  <ToggleOption
                    label="Daily Limit Mode"
                    description="Apply limit as daily allowance"
                    checked={editFormData.isTimeLimitDailyAllowed || false}
                    onChange={(checked) => handleInputChange('isTimeLimitDailyAllowed', checked)}
                    icon={<CalendarDays className="h-5 w-5" />}
                    activeColor="purple"
                    disabled={!editFormData.isAllowed || !editFormData.isTimeLimited}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Allowed Till Date
                      </Label>
                      <Input
                        type="date"
                        value={toDateInputValue(editFormData.allowedTimeLimitTillDate)}
                        onChange={(e) =>
                          handleInputChange(
                            'allowedTimeLimitTillDate',
                            e.target.value ? toEndOfDayIso(e.target.value) : null
                          )
                        }
                        className="bg-white dark:bg-slate-800"
                        disabled={!editFormData.isAllowed || !editFormData.isTimeLimited}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Time Limit (Minutes)
                      </Label>
                      <Input
                        type="number"
                        value={editFormData.timeLimit ?? 0}
                        onChange={(e) => handleInputChange('timeLimit', parseInt(e.target.value, 10) || 0)}
                        className="bg-white dark:bg-slate-800"
                        min="0"
                        step="1"
                        disabled={!editFormData.isAllowed || !editFormData.isTimeLimited}
                      />
                    </div>
                  </div>
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

function CategoryBadge({ category }: { category: string }) {
  const colorMap: Record<string, string> = {
    'Games': 'bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-400',
    'Audio & Music': 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-400',
    'Video': 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400',
    'Photos': 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400',
    'Social Apps': 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400',
    'News': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-400',
    'Maps & Navigations': 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400',
    'Tools & Productivity': 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400',
    'Accessibility': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400',
    'Others': 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  };

  const colorClass = colorMap[category] || colorMap['Others'];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${colorClass}`}>
      {getCategoryIcon(category)}
      {category}
    </span>
  );
}

function AppTypeBadge({ isSystemApp }: { isSystemApp: boolean }) {
  return isSystemApp ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
      <Monitor className="h-3.5 w-3.5" />
      System
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400">
      <Smartphone className="h-3.5 w-3.5" />
      User
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
  disabled?: boolean;
}

function ToggleOption({ label, description, checked, onChange, icon, activeColor, disabled = false }: ToggleOptionProps) {
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

  const containerClasses = disabled
    ? 'cursor-not-allowed opacity-60'
    : 'cursor-pointer hover:border-slate-300 dark:hover:border-slate-600';

  return (
    <label className={`flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors ${containerClasses}`}>
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
          disabled={disabled}
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
