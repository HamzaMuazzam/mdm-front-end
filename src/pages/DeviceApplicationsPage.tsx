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
  if (base64.startsWith('data:')) return base64;
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

// Category gradient for avatar backgrounds
const getCategoryGradient = (category: string): string => {
  const gradients: Record<string, string> = {
    'Games': 'from-pink-500 to-rose-600',
    'Audio & Music': 'from-violet-500 to-purple-600',
    'Video': 'from-red-500 to-rose-600',
    'Photos': 'from-amber-400 to-orange-500',
    'Social Apps': 'from-blue-500 to-indigo-600',
    'News': 'from-cyan-500 to-teal-600',
    'Maps & Navigations': 'from-green-500 to-emerald-600',
    'Tools & Productivity': 'from-orange-500 to-amber-600',
    'Accessibility': 'from-indigo-500 to-blue-600',
    'Others': 'from-slate-500 to-slate-600',
  };
  return gradients[category] || gradients['Others'];
};

// All category options for filter
const categoryOptions = Object.values(ApplicationCategoryInfo).map(info => info.label);

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const toDateInputValue = (value?: string | null): string => {
  if (!value) return '';
  if (DATE_ONLY_PATTERN.test(value)) return value;
  const [datePart] = value.split('T');
  if (datePart && DATE_ONLY_PATTERN.test(datePart)) return datePart;
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return '';
  return parsedDate.toISOString().slice(0, 10);
};

const toEndOfDayIso = (dateValue: string): string => {
  const [year, month, day] = dateValue.split('-').map((part) => Number(part));
  if (!year || !month || !day) return '';
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

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [systemAppFilter, setSystemAppFilter] = useState<string>('all');

  const [editingApp, setEditingApp] = useState<DeviceApplication | null>(null);
  const [editFormData, setEditFormData] = useState<UpdateDeviceApplicationRequest>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredApps = useMemo(() => {
    return deviceApps.filter(app => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        if (!app.appName.toLowerCase().includes(query) &&
            !app.appPackageId.toLowerCase().includes(query)) {
          return false;
        }
      }
      if (categoryFilter !== 'all' && app.applicationCategory !== categoryFilter) return false;
      if (systemAppFilter === 'system' && !app.isSystemApp) return false;
      if (systemAppFilter === 'user' && app.isSystemApp) return false;
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
      await updateMutation.mutateAsync({ appId: editingApp.id, ...payload });
      handleCloseEdit();
    } catch (err) {
      console.error('Failed to update application', err);
    }
  };

  const handleInputChange = (field: keyof UpdateDeviceApplicationRequest, value: any) => {
    setEditFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleRefresh = () => { refetch(); };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      toast({ variant: 'destructive', title: 'File too large', description: 'Please upload an image smaller than 1MB.' });
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const img = new Image();
      img.onload = () => {
        if (img.width > 50 || img.height > 50) {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > height) { height = Math.round((height * 50) / width); width = 50; }
          else { width = Math.round((width * 50) / height); height = 50; }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          handleInputChange('appIconBase64', canvas.toDataURL(file.type));
        } else {
          handleInputChange('appIconBase64', base64String);
        }
      };
      img.src = base64String;
    };
    reader.readAsDataURL(file);
  };

  const triggerFileInput = () => { fileInputRef.current?.click(); };
  const removeIcon = () => { handleInputChange('appIconBase64', null); };

  const stats = useMemo(() => ({
    total: deviceApps.length,
    allowed: deviceApps.filter(a => a.isAllowed).length,
    blocked: deviceApps.filter(a => !a.isAllowed).length,
    visible: deviceApps.filter(a => a.showIcon).length,
  }), [deviceApps]);

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ────────────────────────────────────────────────── */}
      <header className="bg-background/80 backdrop-blur-md border-b border-border sticky top-0 z-20">
        <div className="px-4 sm:px-6">
          {/* Row 1: breadcrumb + device info (md+) + refresh */}
          <div className="flex items-center justify-between gap-3 h-12 sm:h-14">
            <nav className="flex items-center space-x-2 text-sm min-w-0">
              <button onClick={handleBack} className="flex items-center text-muted-foreground hover:text-foreground shrink-0">
                <Home className="h-4 w-4" />
              </button>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              <button onClick={handleBack} className="text-muted-foreground hover:text-foreground shrink-0">Devices</button>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-medium truncate">Applications</span>
            </nav>
            {device && (
              <div className="hidden md:flex items-center gap-4 pl-4 border-l border-border shrink-0">
                <span className="text-sm font-medium text-foreground">{device.model}</span>
                <span className="text-xs font-mono text-muted-foreground">{device.deviceUuid}</span>
                <span className="text-sm text-muted-foreground">{device.userName}</span>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2 shrink-0">
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
          {/* Row 2: search + filters */}
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
                className="appearance-none bg-background border border-border rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer text-foreground"
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
                className="appearance-none bg-background border border-border rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer text-foreground"
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

      <main className="px-4 sm:px-6 py-6 pb-10">

        {/* ── Page title + stats ─────────────────────────────────── */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20">
              <AppWindow className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Device Applications</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Manage installed applications and permissions</p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            <StatPill label="Total" value={stats.total} color="blue" />
            <StatPill label="Allowed" value={stats.allowed} color="green" />
            <StatPill label="Blocked" value={stats.blocked} color="red" />
            <StatPill label="Visible" value={stats.visible} color="purple" />
          </div>
        </div>

        {/* ── Content ──────────────────────────────────────────────── */}
        {isLoading ? (
          <LoadingSkeleton />
        ) : filteredApps.length > 0 ? (
          <>
            {/* ── Mobile: beautiful cards ──────────────────── */}
            <div className="flex flex-col gap-3 md:hidden">
              {filteredApps.map((app) => {
                const accentClass = app.isAllowed ? 'border-l-emerald-500' : 'border-l-red-500';
                const avatarGradient = getCategoryGradient(app.applicationCategory);

                return (
                  <div
                    key={app.id}
                    className={`rounded-xl border border-border border-l-4 ${accentClass} bg-card shadow-sm overflow-hidden`}
                  >
                    {/* Card header: avatar + name + status */}
                    <div className="flex items-start gap-3 p-4 pb-3">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${avatarGradient} flex items-center justify-center shrink-0 shadow-sm overflow-hidden`}>
                        {app.appIconBase64 ? (
                          <img src={getBase64ImageSrc(app.appIconBase64)!} alt={app.appName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-white font-bold text-base">
                            {(app.appName || '?').charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-foreground leading-tight truncate">{app.appName}</p>
                        <p className="text-[11px] font-mono text-muted-foreground truncate mt-0.5">{app.appPackageId}</p>
                      </div>
                      <StatusBadge allowed={app.isAllowed} />
                    </div>

                    {/* Badges row */}
                    <div className="flex items-center gap-1.5 px-4 pb-3 flex-wrap">
                      <VisibilityBadge visible={app.showIcon} />
                      <AppTypeBadge isSystemApp={app.isSystemApp} />
                      <CategoryBadge category={app.applicationCategory} />
                    </div>

                    {/* Meta grid */}
                    <div className="border-t border-border/60 bg-muted/30 px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                      <div>
                        <span className="text-muted-foreground">Version</span>
                        <p className="font-medium text-foreground font-mono">v{app.appVersion}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Order</span>
                        <p className="font-medium text-foreground">#{app.orderNumberInLauncher}</p>
                      </div>
                      {app.installUpdate && (
                        <div className="col-span-2">
                          <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                            <Download className="h-3 w-3" /> Auto Update Enabled
                          </span>
                        </div>
                      )}
                      {(app.isTimeLimited || app.isTimeLimitDailyAllowed || app.allowedTimeLimitTillDate) && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Time Controls</span>
                          <div className="flex flex-wrap gap-1.5 mt-1">
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
                        </div>
                      )}
                    </div>

                    {/* Action footer */}
                    <div className="px-4 py-2.5 border-t border-border/60 flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(app)}
                        className="h-8 gap-1.5 text-xs"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit App
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Desktop table ────────────────────────────── */}
            <Card className="hidden md:block shadow-sm border overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Application</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</th>
                        <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Version</th>
                        <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                        <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Visibility</th>
                        <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Order</th>
                        <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Auto Update</th>
                        <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredApps.map((app) => (
                        <tr key={app.id} className="group hover:bg-muted/40 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className={`flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br ${getCategoryGradient(app.applicationCategory)} flex items-center justify-center overflow-hidden shadow-sm`}>
                                {app.appIconBase64 ? (
                                  <img src={getBase64ImageSrc(app.appIconBase64)!} alt={app.appName} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-white font-bold text-sm">
                                    {(app.appName || '?').charAt(0).toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-foreground text-sm truncate">{app.appName}</p>
                                <p className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">{app.appPackageId}</p>
                                {(app.isTimeLimited || app.isTimeLimitDailyAllowed || app.allowedTimeLimitTillDate) && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {app.isTimeLimited && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                                        <Clock3 className="h-2.5 w-2.5" />{`${app.timeLimit ?? 0}m`}
                                      </span>
                                    )}
                                    {app.isTimeLimitDailyAllowed && (
                                      <span className="inline-flex items-center rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">Daily</span>
                                    )}
                                    {app.allowedTimeLimitTillDate && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800 dark:bg-violet-900/50 dark:text-violet-300">
                                        <CalendarDays className="h-2.5 w-2.5" />Till {toDateInputValue(app.allowedTimeLimitTillDate)}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5"><CategoryBadge category={app.applicationCategory} /></td>
                          <td className="px-5 py-3.5 text-center"><AppTypeBadge isSystemApp={app.isSystemApp} /></td>
                          <td className="px-5 py-3.5">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-muted text-xs font-medium text-muted-foreground">v{app.appVersion}</span>
                          </td>
                          <td className="px-5 py-3.5 text-center"><StatusBadge allowed={app.isAllowed} /></td>
                          <td className="px-5 py-3.5 text-center"><VisibilityBadge visible={app.showIcon} /></td>
                          <td className="px-5 py-3.5 text-center">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-muted text-sm font-semibold text-foreground">{app.orderNumberInLauncher}</span>
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            {app.installUpdate ? (
                              <span className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                                <Download className="h-4 w-4" /><span className="text-xs font-medium">On</span>
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">Off</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <Button size="sm" variant="ghost" onClick={() => handleEdit(app)} className="opacity-60 group-hover:opacity-100 transition-opacity">
                              <Pencil className="h-4 w-4 mr-1.5" />Edit
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        ) : deviceApps.length > 0 ? (
          <EmptySearchState query={searchQuery} onClear={() => setSearchQuery('')} />
        ) : (
          <EmptyState />
        )}
      </main>

      {/* ── Edit Slide-over Panel ─────────────────────────────────── */}
      {editingApp && (
        <>
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30" onClick={handleCloseEdit} />
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-card shadow-2xl z-40 overflow-hidden flex flex-col">

            {/* Panel header with status stripe */}
            <div className={`px-6 pt-5 pb-4 border-b border-border ${
              editFormData.isAllowed
                ? 'bg-emerald-50/60 dark:bg-emerald-900/20'
                : 'bg-red-50/60 dark:bg-red-900/20'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${getCategoryGradient(editingApp.applicationCategory)} flex items-center justify-center shadow-md shrink-0 overflow-hidden`}>
                    {editFormData.appIconBase64 ? (
                      <img src={getBase64ImageSrc(editFormData.appIconBase64)!} alt="App Icon" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white font-bold text-xl">
                        {(editingApp.appName || '?').charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground leading-tight truncate">{editingApp.appName}</p>
                    <p className="text-xs font-mono text-muted-foreground truncate mt-0.5">{editingApp.appPackageId}</p>
                    <div className="mt-1.5"><StatusBadge allowed={editFormData.isAllowed ?? false} /></div>
                  </div>
                </div>
                <button onClick={handleCloseEdit} className="p-2 rounded-lg hover:bg-muted transition-colors shrink-0">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">

              {/* Read-only details grid */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">App Details</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-muted/50 border border-border p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Category</p>
                    <div className="mt-0.5"><CategoryBadge category={editingApp.applicationCategory} /></div>
                  </div>
                  <div className="rounded-xl bg-muted/50 border border-border p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Type</p>
                    <div className="mt-0.5"><AppTypeBadge isSystemApp={editingApp.isSystemApp} /></div>
                  </div>
                </div>
              </div>

              {/* App Icon Upload */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Application Icon <span className="normal-case font-normal">(Max 50×50)</span></p>
                <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 border border-border">
                  <div className="w-16 h-16 rounded-xl flex items-center justify-center overflow-hidden border border-border bg-background shrink-0">
                    {editFormData.appIconBase64 ? (
                      <img src={getBase64ImageSrc(editFormData.appIconBase64)!} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                    <Button type="button" variant="outline" size="sm" onClick={triggerFileInput} className="gap-2">
                      <Upload className="h-4 w-4" />Upload Icon
                    </Button>
                    {editFormData.appIconBase64 && (
                      <Button type="button" variant="ghost" size="sm" onClick={removeIcon} className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
                        Remove Icon
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Edit Fields</p>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Application Name</Label>
                  <Input value={editFormData.appName || ''} onChange={(e) => handleInputChange('appName', e.target.value)} />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Package ID</Label>
                  <Input value={editFormData.appPackageId || ''} onChange={(e) => handleInputChange('appPackageId', e.target.value)} className="font-mono text-sm" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Version</Label>
                    <Input value={editFormData.appVersion || ''} onChange={(e) => handleInputChange('appVersion', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <Hash className="h-3.5 w-3.5" />Order
                    </Label>
                    <Input type="number" value={editFormData.orderNumberInLauncher || 0} onChange={(e) => handleInputChange('orderNumberInLauncher', parseInt(e.target.value) || 0)} min="0" />
                  </div>
                </div>
              </div>

              {/* Toggle Options */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Permissions</p>
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
              <div className={`space-y-3 rounded-xl border border-border bg-muted/30 p-4 ${editFormData.isAllowed ? '' : 'opacity-50'}`}>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Usage Time Controls</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {editFormData.isAllowed ? 'Configure time limits for this app.' : 'Enable "Allow Application" to configure time limits.'}
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
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Allowed Till Date</Label>
                    <Input
                      type="date"
                      value={toDateInputValue(editFormData.allowedTimeLimitTillDate)}
                      onChange={(e) => handleInputChange('allowedTimeLimitTillDate', e.target.value ? toEndOfDayIso(e.target.value) : null)}
                      disabled={!editFormData.isAllowed || !editFormData.isTimeLimited}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Time Limit (min)</Label>
                    <Input
                      type="number"
                      value={editFormData.timeLimit ?? 0}
                      onChange={(e) => handleInputChange('timeLimit', parseInt(e.target.value, 10) || 0)}
                      min="0"
                      step="1"
                      disabled={!editFormData.isAllowed || !editFormData.isTimeLimited}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Panel footer */}
            <div className="px-5 py-4 border-t border-border bg-muted/30">
              <div className="flex gap-3">
                <Button variant="outline" onClick={handleCloseEdit} className="flex-1" disabled={updateMutation.isPending}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
                >
                  {updateMutation.isPending ? (
                    <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Saving...</>
                  ) : (
                    <><Save className="h-4 w-4 mr-2" />Save Changes</>
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

// ── Helper Components ──────────────────────────────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: number; color: 'blue' | 'green' | 'red' | 'purple' }) {
  const cfg = {
    blue:   'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
    green:  'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
    red:    'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
    purple: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
  };
  return (
    <div className={`flex flex-col items-center justify-center rounded-xl border px-3 py-2 ${cfg[color]}`}>
      <span className="text-xl font-bold leading-none">{value}</span>
      <span className="text-[10px] font-medium mt-0.5 uppercase tracking-wide opacity-80">{label}</span>
    </div>
  );
}

function StatusBadge({ allowed }: { allowed: boolean }) {
  return allowed ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Allowed
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />Blocked
    </span>
  );
}

function VisibilityBadge({ visible }: { visible: boolean }) {
  return visible ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 text-[11px] font-medium">
      <Eye className="h-3 w-3" />Visible
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[11px] font-medium">
      <EyeOff className="h-3 w-3" />Hidden
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
    'Others': 'bg-muted text-muted-foreground',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-medium ${colorMap[category] || colorMap['Others']}`}>
      {getCategoryIcon(category)}
      {category}
    </span>
  );
}

function AppTypeBadge({ isSystemApp }: { isSystemApp: boolean }) {
  return isSystemApp ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium bg-muted text-muted-foreground">
      <Monitor className="h-3.5 w-3.5" />System
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400">
      <Smartphone className="h-3.5 w-3.5" />User
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
  const trackClasses = {
    green: 'peer-checked:bg-emerald-500',
    purple: 'peer-checked:bg-purple-500',
    blue: 'peer-checked:bg-blue-500',
  };
  const iconColorClasses = {
    green: checked ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
    purple: checked ? 'text-purple-600 dark:text-purple-400' : 'text-muted-foreground',
    blue: checked ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground',
  };
  return (
    <label className={`flex items-center justify-between p-3.5 bg-card rounded-xl border border-border transition-colors ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-primary/30'}`}>
      <div className="flex items-center gap-3">
        <div className={iconColorClasses[activeColor]}>{icon}</div>
        <div>
          <p className="font-medium text-sm text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="relative">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} className="sr-only peer" />
        <div className={`w-11 h-6 bg-muted rounded-full peer ${trackClasses[activeColor]} peer-focus:ring-2 peer-focus:ring-primary/30 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5`} />
      </div>
    </label>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 animate-pulse">
          <div className="w-10 h-10 bg-muted rounded-xl" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-3 bg-muted rounded w-1/2" />
          </div>
          <div className="h-6 bg-muted rounded-full w-20" />
          <div className="h-6 bg-muted rounded-full w-16" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-4">
        <Package className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">No Applications Found</h3>
      <p className="text-sm text-muted-foreground text-center max-w-sm">
        This device doesn't have any registered applications yet. Applications will appear here once they are installed on the device.
      </p>
    </div>
  );
}

function EmptySearchState({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-4">
        <Search className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">No Results Found</h3>
      <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
        No applications match "<span className="font-medium">{query}</span>". Try a different search term.
      </p>
      <Button variant="outline" size="sm" onClick={onClear}>Clear Search</Button>
    </div>
  );
}
