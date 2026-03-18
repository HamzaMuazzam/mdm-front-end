import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { deviceSchema, updateDeviceSchema } from '@/utils/validators';
import { useDevicesQuery, useCreateDevice, useToggleDeviceStatus, useUpdateDevice, useDeviceConfiguration, useUpdateDeviceConfiguration, useApplicationPermissionGranters, useFeatureStates, useLocationTrackingTypes, usePushNotificationProtocols } from '@/hooks/useDevices';
import { useUpdateNotificationSettings } from '@/hooks/useNotifications';
import { useDeviceStatusMqtt, useDeviceStatusStore } from '@/hooks/useDeviceStatus';
import { notificationService } from '@/api/services/notification.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Wifi, MapPin, Bell, Smartphone, Monitor, Lock, X, Check, AlertCircle, Pencil, Save, AppWindow, Key, FileText, QrCode, Download, Eye, BarChart3, MoreVertical, Power, RotateCcw, Siren, Mic, Database } from 'lucide-react';
import QRCode from 'qrcode';
import type { CreateDeviceRequest, UpdateDeviceRequest, Device, UpdateDeviceConfigurationRequest } from '@/types/device.types';
import { ROUTES } from '@/utils/constants';
import { toast } from '@/hooks/useToast';
import { sendDeviceCommandViaApi, type DeviceCommandType } from '@/services/deviceCommandMqtt';
import { mqttService } from '@/api/services/mqtt.service';
import { usePermissionStore } from '@/store/permissionStore';

export function DeviceManagement() {
  const navigate = useNavigate();
  useDeviceStatusMqtt();
  const deviceStatuses = useDeviceStatusStore((s) => s.statuses);
  const setDeviceStatus = useDeviceStatusStore((s) => s.setStatus);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isToggleDialogOpen, setIsToggleDialogOpen] = useState(false);
  const [isCommandDialogOpen, setIsCommandDialogOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isConfigEditMode, setIsConfigEditMode] = useState(false);
  const [isBackgroundImageEnabled, setIsBackgroundImageEnabled] = useState(false);
  const [openActionMenuDeviceId, setOpenActionMenuDeviceId] = useState<number | null>(null);
  const [alertStatusByDevice, setAlertStatusByDevice] = useState<Record<number, boolean>>({});
  const [alertStatusLoading, setAlertStatusLoading] = useState<Record<number, boolean>>({});
  const [deviceToToggle, setDeviceToToggle] = useState<Device | null>(null);
  const [commandTarget, setCommandTarget] = useState<{ device: Device; command: DeviceCommandType } | null>(null);
  const [isCommandSending, setIsCommandSending] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [configDeviceId, setConfigDeviceId] = useState<number | null>(null);
  const [configFormData, setConfigFormData] = useState<UpdateDeviceConfigurationRequest>({});
  const hasPermission = usePermissionStore((state) => state.hasPermission);
  const { data: devices = [], isLoading } = useDevicesQuery();
  const { data: deviceConfig, isLoading: isLoadingConfig } = useDeviceConfiguration(configDeviceId);
  const createMutation = useCreateDevice();
  const updateMutation = useUpdateDevice();
  const toggleStatusMutation = useToggleDeviceStatus();
  const updateConfigMutation = useUpdateDeviceConfiguration();
  const updateNotificationSettingsMutation = useUpdateNotificationSettings();

  // Configuration enum data
  const { data: permissionGranters = [] } = useApplicationPermissionGranters();
  const { data: featureStates = [] } = useFeatureStates();
  const { data: locationTrackingTypes = [] } = useLocationTrackingTypes();
  const { data: pushNotificationProtocols = [] } = usePushNotificationProtocols();

  const {
    register,
    handleSubmit,
    reset,
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
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-device-actions-menu]')) {
        setOpenActionMenuDeviceId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // On page load/refresh, seed status map from backend client list so status is visible before MQTT events arrive
  useEffect(() => {
    if (devices.length === 0) return;

    let cancelled = false;

    const syncPresenceFromBackend = async () => {
      try {
        const clients = await mqttService.getClients();
        if (cancelled) return;

        const onlineDeviceIds = new Set(
          clients
            .filter((client) => client.status?.toLowerCase() === 'online')
            .map((client) => client.deviceId || client.clientId)
            .filter((deviceId): deviceId is string => Boolean(deviceId))
        );

        devices.forEach((device) => {
          setDeviceStatus(device.deviceUuid, onlineDeviceIds.has(device.deviceUuid) ? 'online' : 'offline');
        });
      } catch (error) {
        console.error('Failed to sync device presence from MQTT clients endpoint', error);
      }
    };

    syncPresenceFromBackend();

    return () => {
      cancelled = true;
    };
  }, [devices, setDeviceStatus]);

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
        devicePassword: deviceConfig.devicePassword??'', // Initialize devicePassword
      });
      setIsBackgroundImageEnabled(!!deviceConfig.backgroundImageUrl);
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

  const handleViewNotifications = (device: Device) => {
    navigate(`/device/${device.id}/notifications`);
  };

  const handleSendAlert = (device: Device) => {
    navigate(`/device/${device.id}/alert`);
  };

  const handleListenAudio = (device: Device) => {
    navigate(`/device/${device.id}/audio`);
  };

  const handleMonitorData = (device: Device) => {
    navigate(`/device/${device.id}/data`);
  };

  const fetchAlertStatus = useCallback(async (deviceId: number) => {
    if (alertStatusByDevice[deviceId] !== undefined || alertStatusLoading[deviceId]) return;
    setAlertStatusLoading((prev) => ({ ...prev, [deviceId]: true }));
    try {
      const settings = await notificationService.getSettings(deviceId);
      setAlertStatusByDevice((prev) => ({ ...prev, [deviceId]: settings.alertsEnabled }));
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'Failed to load alert status.';
      toast({
        variant: 'destructive',
        title: 'Alert Status Failed',
        description: message,
      });
    } finally {
      setAlertStatusLoading((prev) => ({ ...prev, [deviceId]: false }));
    }
  }, [alertStatusByDevice, alertStatusLoading]);

  const handleToggleAlerts = async (device: Device) => {
    try {
      let currentStatus = alertStatusByDevice[device.id];
      if (currentStatus === undefined) {
        setAlertStatusLoading((prev) => ({ ...prev, [device.id]: true }));
        const settings = await notificationService.getSettings(device.id);
        currentStatus = settings.alertsEnabled;
        setAlertStatusByDevice((prev) => ({ ...prev, [device.id]: currentStatus! }));
      }
      const nextStatus = !currentStatus;
      await updateNotificationSettingsMutation.mutateAsync({
        deviceId: device.id,
        alertsEnabled: nextStatus,
      });
      setAlertStatusByDevice((prev) => ({ ...prev, [device.id]: nextStatus }));
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'Failed to update notification alerts.';
      toast({
        variant: 'destructive',
        title: 'Alert Update Failed',
        description: message,
      });
    } finally {
      setAlertStatusLoading((prev) => ({ ...prev, [device.id]: false }));
    }
  };

  const handleOpenActionsMenu = (deviceId: number) => {
    setOpenActionMenuDeviceId((previous) => {
      const next = previous === deviceId ? null : deviceId;
      if (next !== null) {
        void fetchAlertStatus(deviceId);
      }
      return next;
    });
  };

  const closeActionsMenu = () => {
    setOpenActionMenuDeviceId(null);
  };

  const handleOpenCommandDialog = (device: Device, command: DeviceCommandType) => {
    setCommandTarget({ device, command });
    setIsCommandDialogOpen(true);
    closeActionsMenu();
  };

  const handleCloseCommandDialog = () => {
    if (isCommandSending) return;
    setIsCommandDialogOpen(false);
    setCommandTarget(null);
  };

  const handleConfirmCommand = async () => {
    if (!commandTarget) return;

    try {
      setIsCommandSending(true);
      const result = await sendDeviceCommandViaApi({
        deviceUuid: commandTarget.device.deviceUuid,
        command: commandTarget.command,
      });

      toast({
        variant: 'success',
        title: `${commandTarget.command === 'reboot' ? 'Reboot' : 'Reset'} command sent`,
        description: `Command sent via API for topic ${result.command}`,
      });

      setIsCommandDialogOpen(false);
      setCommandTarget(null);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Command failed',
        description: error?.message || 'Unable to send command via API.',
      });
    } finally {
      setIsCommandSending(false);
    }
  };

  const handleOpenMonitorDashboard = (device: Device) => {
    const monitorPath = ROUTES.DEVICE_MONITOR.replace(':deviceId', device.id.toString());
    window.open(monitorPath, '_blank', 'noopener,noreferrer');
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

  // Gradient palette for device avatars (cycles by device id)
  const avatarGradients = [
    'from-blue-500 to-indigo-600',
    'from-violet-500 to-purple-600',
    'from-emerald-500 to-teal-600',
    'from-orange-500 to-amber-600',
    'from-pink-500 to-rose-600',
    'from-cyan-500 to-blue-600',
  ];

  return (
    <div className="flex h-full flex-col">
      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6">
        {/* Mobile: icon + title stacked */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20 sm:hidden">
            <Smartphone className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Device Management</h1>
            <p className="text-xs text-muted-foreground mt-0.5 sm:hidden">{devices.length} device{devices.length !== 1 ? 's' : ''} registered</p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={() => setIsQrModalOpen(true)} className="flex-1 sm:flex-none">
            <QrCode className="h-4 w-4 mr-2" />
            QR View
          </Button>
          {hasPermission('devices:create') && (
            <Button onClick={() => setIsModalOpen(true)} className="flex-1 sm:flex-none bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white border-0">
              + Add Device
            </Button>
          )}
        </div>
      </div>

      {/* ── Mobile: beautiful card list (hidden on sm+) ─────────── */}
      <div className="flex flex-col gap-3 sm:hidden pb-4">
        {devices.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-3">
              <Smartphone className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground mb-1">No Devices Found</p>
            <p className="text-sm text-muted-foreground text-center">Add your first device to get started.</p>
          </div>
        )}
        {devices.map((device: Device) => {
          const isActive = !device.deletedAt;
          const onlineStatus = deviceStatuses[device.deviceUuid];
          const gradient = avatarGradients[device.id % avatarGradients.length];
          const alertsEnabled = alertStatusByDevice[device.id];
          const alertsLoading = alertStatusLoading[device.id];
          const alertsLabel = alertsEnabled === undefined ? 'Alerts' : alertsEnabled ? 'Alerts Enabled' : 'Alerts Disabled';
          const alertsMenuClass = alertsEnabled === true
            ? 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
            : alertsEnabled === false
            ? 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20'
            : 'text-foreground hover:bg-muted';
          // Left border: green if active+online, amber if active+offline/unknown, red if inactive
          const accentClass = !isActive
            ? 'border-l-red-500'
            : onlineStatus === 'online'
            ? 'border-l-emerald-500'
            : 'border-l-amber-400';

          return (
            <div
              key={device.id}
              className={`rounded-xl border border-border border-l-4 ${accentClass} bg-card shadow-sm overflow-hidden${!isActive ? ' opacity-70' : ''}`}
            >
              {/* ── Card header: avatar + info + status badge ── */}
              <div className="flex items-start gap-3 p-4 pb-3">
                {/* Avatar with live-status overlay */}
                <div className="relative shrink-0">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-md`}>
                    <span className="text-white font-bold text-lg leading-none">
                      {(device.deviceName || device.deviceUuid || 'D').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  {/* Status dot — bottom-right corner of avatar */}
                  <span className="absolute -bottom-0.5 -right-0.5 block">
                    <DeviceStatusDot status={onlineStatus} />
                  </span>
                </div>

                {/* Name + email + model */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-0.5">
                    <p className="font-semibold text-sm text-foreground leading-snug truncate">{device.deviceName || 'Unnamed Device'}</p>
                    <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      isActive
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      {isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {device.userEmail && (
                    <p className="text-xs text-muted-foreground truncate">{device.userEmail}</p>
                  )}
                  {(device.model || device.osVersion) && (
                    <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                      {[device.model, device.osVersion].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {device.description && (
                    <p className="text-[11px] text-muted-foreground/60 italic truncate mt-0.5">{device.description}</p>
                  )}
                </div>
              </div>

              {/* ── UUID meta row ── */}
              <div className="border-t border-border/50 bg-muted/30 px-4 py-2 flex items-center gap-2">
                <Monitor className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                <p className="text-[11px] font-mono text-muted-foreground truncate">{device.deviceUuid}</p>
              </div>

              {/* ── Quick action buttons ── */}
              <div className="border-t border-border/50 px-2 py-1.5 flex flex-wrap items-center gap-0.5">
                {hasPermission('devices:monitoring') && (
                  <button
                    type="button"
                    onClick={() => handleOpenMonitorDashboard(device)}
                    className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <BarChart3 className="h-4 w-4" />
                    <span className="text-[10px] font-medium">Monitor</span>
                  </button>
                )}
                {hasPermission('devices:applications:read') && (
                  <button
                    type="button"
                    onClick={() => handleViewApps(device)}
                    className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <AppWindow className="h-4 w-4" />
                    <span className="text-[10px] font-medium">Apps</span>
                  </button>
                )}
                {hasPermission('devices:update') && (
                  <button
                    type="button"
                    onClick={() => handleEdit(device)}
                    className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                    <span className="text-[10px] font-medium">Edit</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleViewRequests(device)}
                  className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                >
                  <FileText className="h-4 w-4" />
                  <span className="text-[10px] font-medium">Requests</span>
                </button>
                {hasPermission('notifications:view-history') && (
                  <button
                    type="button"
                    onClick={() => handleViewNotifications(device)}
                    className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <Bell className="h-4 w-4" />
                    <span className="text-[10px] font-medium">Notifications</span>
                  </button>
                )}
                {hasPermission('notifications:manage-alerts') && (
                  <button
                    type="button"
                    onClick={() => handleToggleAlerts(device)}
                    className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <Bell className="h-4 w-4" />
                    <span className="text-[10px] font-medium">Alerts</span>
                  </button>
                )}
                {hasPermission('device-alerts:send') && (
                  <button
                    type="button"
                    onClick={() => handleSendAlert(device)}
                    className="flex flex-col items-center gap-0.5 px-2.5 py-2 rounded-lg bg-red-600 hover:bg-red-700 active:bg-red-800 transition-colors text-white"
                  >
                    <Siren className="h-4 w-4" />
                    <span className="text-[10px] font-semibold">Send Alarm</span>
                  </button>
                )}

                {hasPermission('device-audio:listen') && (
                  <button
                    type="button"
                    onClick={() => handleListenAudio(device)}
                    className="flex flex-col items-center gap-0.5 px-2.5 py-2 rounded-lg bg-green-600 hover:bg-green-700 active:bg-green-800 transition-colors text-white"
                  >
                    <Mic className="h-4 w-4" />
                  </button>
                )}
                {hasPermission('device-data:read') && (
                  <button
                    type="button"
                    onClick={() => handleMonitorData(device)}
                    className="flex flex-col items-center gap-0.5 px-2.5 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 active:bg-violet-800 transition-colors text-white"
                  >
                    <Database className="h-4 w-4" />
                    <span className="text-[10px] font-semibold">Listen</span>
                  </button>
                )}

                {/* Overflow menu */}
                <div className="relative ml-auto" data-device-actions-menu>
                  <button
                    type="button"
                    onClick={() => handleOpenActionsMenu(device.id)}
                    className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <MoreVertical className="h-4 w-4" />
                    <span className="text-[10px] font-medium">More</span>
                  </button>
                  {openActionMenuDeviceId === device.id && (
                    <div className="absolute right-0 bottom-full mb-2 z-30 w-56 overflow-hidden rounded-xl border border-border bg-popover shadow-2xl">
                      <div className="px-3 py-2 border-b border-border bg-muted/40">
                        <p className="text-xs font-semibold text-foreground truncate">{device.deviceName || 'Device'}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{device.userEmail || device.deviceUuid}</p>
                      </div>
                      {hasPermission('devices:configurations:read') && (
                        <button type="button" className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-foreground hover:bg-muted transition-colors" onClick={() => { closeActionsMenu(); handleViewConfig(device); }}>
                          <Settings className="h-4 w-4 text-muted-foreground" /> Configuration
                        </button>
                      )}
                      {hasPermission('notifications:view-history') && (
                        <button type="button" className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-foreground hover:bg-muted transition-colors" onClick={() => { closeActionsMenu(); handleViewNotifications(device); }}>
                          <Bell className="h-4 w-4 text-muted-foreground" /> View Notifications
                        </button>
                      )}
                      {hasPermission('device-alerts:send') && (
                        <button type="button" className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 transition-colors" onClick={() => { closeActionsMenu(); handleSendAlert(device); }}>
                          <Siren className="h-4 w-4" /> Send Alarm
                        </button>
                      )}
                      {hasPermission('device-audio:listen') && (
                        <button type="button" className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-green-600 hover:bg-green-50 transition-colors" onClick={() => { closeActionsMenu(); handleListenAudio(device); }}>
                          <Mic className="h-4 w-4" /> Listen to Device
                        </button>
                      )}
                      {hasPermission('device-data:read') && (
                        <button type="button" className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-violet-600 hover:bg-violet-50 transition-colors" onClick={() => { closeActionsMenu(); handleMonitorData(device); }}>
                          <Database className="h-4 w-4" /> Contacts &amp; SMS &amp; Calls
                        </button>
                      )}
                      {hasPermission('notifications:manage-alerts') && (
                        <button
                          type="button"
                          className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors ${alertsMenuClass}`}
                          onClick={() => { closeActionsMenu(); handleToggleAlerts(device); }}
                          disabled={alertsLoading || updateNotificationSettingsMutation.isPending}
                        >
                          <Bell className="h-4 w-4" /> {alertsLabel}
                        </button>
                      )}
                      <button type="button" className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-foreground hover:bg-muted transition-colors" onClick={() => { closeActionsMenu(); handleShowCode(device.deviceVerificationCode); }}>
                        <Key className="h-4 w-4 text-muted-foreground" /> Verification Code
                      </button>
                      {hasPermission('devices:update') && (
                        <>
                          <div className="my-1 h-px bg-border" />
                          <button type="button" className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-foreground hover:bg-muted transition-colors" onClick={() => { closeActionsMenu(); handleOpenCommandDialog(device, 'reboot'); }}>
                            <Power className="h-4 w-4 text-muted-foreground" /> Reboot Device
                          </button>
                          <button type="button" className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" onClick={() => { closeActionsMenu(); handleOpenCommandDialog(device, 'reset'); }}>
                            <RotateCcw className="h-4 w-4" /> Factory Reset
                          </button>
                        </>
                      )}
                      {hasPermission('devices:delete') && (
                        <>
                          <div className="my-1 h-px bg-border" />
                          <button
                            type="button"
                            className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors ${
                              isActive
                                ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                                : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                            }`}
                            onClick={() => { closeActionsMenu(); handleToggleClick(device); }}
                            disabled={toggleStatusMutation.isPending}
                          >
                            {isActive ? <AlertCircle className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                            {isActive ? 'Deactivate Device' : 'Activate Device'}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Desktop: full table (hidden below sm) ──────────────────────────── */}
      <Card className="hidden sm:flex flex-col flex-1 min-h-0">
        <CardContent className="h-full p-0">
          <div className="h-full overflow-auto">
            <table className="w-full">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  {/*<th className="px-4 py-3 text-left text-sm font-medium">ID</th>*/}
                  <th className="px-4 py-3 text-center text-sm font-medium">Live</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Device UUID</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Device Name</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">User Email</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Model</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">OS Version</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Description</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                  {/*<th className="px-4 py-3 text-left text-sm font-medium">Deleted At</th>*/}
                  <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {devices.map((device:Device) => {
                  const isActive = !device.deletedAt;
                  const alertsEnabled = alertStatusByDevice[device.id];
                  const alertsLoading = alertStatusLoading[device.id];
                  const alertsLabel = alertsEnabled === undefined ? 'Alerts' : alertsEnabled ? 'Alerts Enabled' : 'Alerts Disabled';
                  const alertsMenuClass = alertsEnabled === true
                    ? 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                    : alertsEnabled === false
                    ? 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                    : 'text-foreground hover:bg-muted';
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
                      <td className="px-4 py-3 text-sm">{device.deviceName}</td>
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
                        <div className="relative inline-block text-left" data-device-actions-menu>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenActionsMenu(device.id)}
                            title="More actions"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>

                          {openActionMenuDeviceId === device.id && (
                            <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-md border border-border bg-popover shadow-lg">
                              {hasPermission('devices:monitoring') && (
                                <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { closeActionsMenu(); handleOpenMonitorDashboard(device); }}>
                                  <BarChart3 className="h-4 w-4" /> Open Monitor Dashboard
                                </button>
                              )}
                              <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { closeActionsMenu(); handleShowCode(device.deviceVerificationCode); }}>
                                <Key className="h-4 w-4" /> Show Verification Code
                              </button>
                              {hasPermission('devices:configurations:read') && (
                                <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { closeActionsMenu(); handleViewConfig(device); }}>
                                  <Settings className="h-4 w-4" /> View Configuration
                                </button>
                              )}
                              {hasPermission('devices:applications:read') && (
                                <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { closeActionsMenu(); handleViewApps(device); }}>
                                  <AppWindow className="h-4 w-4" /> View Applications
                                </button>
                              )}
                              <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { closeActionsMenu(); handleViewRequests(device); }}>
                                <FileText className="h-4 w-4" /> View Requests
                              </button>
                              {hasPermission('notifications:view-history') && (
                                <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { closeActionsMenu(); handleViewNotifications(device); }}>
                                  <Bell className="h-4 w-4" /> View Notifications
                                </button>
                              )}
                              {hasPermission('notifications:manage-alerts') && (
                                <button
                                  type="button"
                                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${alertsMenuClass}`}
                                  onClick={() => { closeActionsMenu(); handleToggleAlerts(device); }}
                                  disabled={alertsLoading || updateNotificationSettingsMutation.isPending}
                                >
                                  <Bell className="h-4 w-4" /> {alertsLabel}
                                </button>
                              )}
                              {hasPermission('device-alerts:send') && (
                                <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50" onClick={() => { closeActionsMenu(); handleSendAlert(device); }}>
                                  <Siren className="h-4 w-4" /> Send Alarm
                                </button>
                              )}
                              {hasPermission('device-audio:listen') && (
                                <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-green-600 hover:bg-green-50" onClick={() => { closeActionsMenu(); handleListenAudio(device); }}>
                                  <Mic className="h-4 w-4" /> Listen to Device
                                </button>
                              )}
                              {hasPermission('device-data:read') && (
                                <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-violet-600 hover:bg-violet-50" onClick={() => { closeActionsMenu(); handleMonitorData(device); }}>
                                  <Database className="h-4 w-4" /> Contacts &amp; SMS &amp; Calls
                                </button>
                              )}
                              {hasPermission('devices:update') && (
                                <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { closeActionsMenu(); handleEdit(device); }}>
                                  <Pencil className="h-4 w-4" /> Edit Device
                                </button>
                              )}
                              {hasPermission('devices:update') && (
                                <>
                                  <div className="my-1 h-px bg-border" />
                                  <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => handleOpenCommandDialog(device, 'reboot')}>
                                    <Power className="h-4 w-4" /> Reboot
                                  </button>
                                  <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30" onClick={() => handleOpenCommandDialog(device, 'reset')}>
                                    <RotateCcw className="h-4 w-4" /> Reset
                                  </button>
                                </>
                              )}
                              {hasPermission('devices:delete') && (
                                <>
                                  <div className="my-1 h-px bg-border" />
                                  <button
                                    type="button"
                                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${isActive ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30' : 'text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/30'}`}
                                    onClick={() => { closeActionsMenu(); handleToggleClick(device); }}
                                    disabled={toggleStatusMutation.isPending}
                                  >
                                    {isActive ? <AlertCircle className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                                    {isActive ? 'Deactivate Device' : 'Activate Device'}
                                  </button>
                                </>
                              )}
                            </div>
                          )}
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
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <Card className="w-full sm:max-w-md rounded-b-none sm:rounded-lg max-h-[92dvh] overflow-y-auto">
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

                <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-1">
                  <Button type="button" variant="outline" onClick={() => { setIsModalOpen(false); reset(); }} className="w-full sm:w-auto">Cancel</Button>
                  <Button type="submit" disabled={createMutation.isPending} className="w-full sm:w-auto">
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
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <Card className="w-full sm:max-w-md rounded-b-none sm:rounded-lg max-h-[92dvh] overflow-y-auto">
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

                <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-1">
                  <Button type="button" variant="outline" onClick={() => { setIsEditModalOpen(false); setEditingDevice(null); resetEdit(); }} className="w-full sm:w-auto">Cancel</Button>
                  <Button type="submit" disabled={updateMutation.isPending} className="w-full sm:w-auto">
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
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <Card className="w-full sm:max-w-sm rounded-b-none sm:rounded-lg">
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
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                <Button type="button" variant="outline" onClick={() => { setIsToggleDialogOpen(false); setDeviceToToggle(null); }} className="w-full sm:w-auto">Cancel</Button>
                <Button variant={!deviceToToggle.deletedAt ? 'destructive' : 'default'} onClick={handleToggleConfirm} disabled={toggleStatusMutation.isPending} className="w-full sm:w-auto">
                  {toggleStatusMutation.isPending ? 'Processing...' : !deviceToToggle.deletedAt ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reboot / Reset Confirmation Dialog */}
      {isCommandDialogOpen && commandTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <Card className="w-full sm:max-w-sm rounded-b-none sm:rounded-lg">
            <CardHeader>
              <CardTitle>
                {commandTarget.command === 'reboot' ? 'Reboot Device' : 'Reset Device'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {`Are you sure you want to send "${commandTarget.command}" command to device "${commandTarget.device.deviceUuid}"?`}
              </p>
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                <Button type="button" variant="outline" onClick={handleCloseCommandDialog} disabled={isCommandSending} className="w-full sm:w-auto">Cancel</Button>
                <Button variant={commandTarget.command === 'reset' ? 'destructive' : 'default'} onClick={handleConfirmCommand} disabled={isCommandSending} className="w-full sm:w-auto">
                  {isCommandSending ? 'Sending...' : commandTarget.command === 'reboot' ? 'Confirm Reboot' : 'Confirm Reset'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* QR Code Modal */}
      {isQrModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <Card className="w-full sm:max-w-sm rounded-b-none sm:rounded-lg">
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
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <Card className="w-full sm:max-w-4xl rounded-b-none sm:rounded-lg max-h-[92dvh] overflow-hidden flex flex-col">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-4">
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
              <div className="flex flex-wrap gap-2">
                {deviceConfig && !isConfigEditMode && hasPermission('devices:configurations:update') && (
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
                            devicePassword: deviceConfig.devicePassword??'', // Initialize devicePassword
                          });
                          setIsBackgroundImageEnabled(!!deviceConfig.backgroundImageUrl);
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
            <CardContent className="overflow-y-auto p-4 sm:p-6">
              {isLoadingConfig ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : deviceConfig ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
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
                    <ConfigEditItem
                      label="Show Launcher Notification Bar"
                      value={<BooleanBadge value={deviceConfig.showLauncherOwnNotificationBar} />}
                      editValue={configFormData.showLauncherOwnNotificationBar}
                      isEditMode={isConfigEditMode}
                      onChange={(v) => handleConfigInputChange('showLauncherOwnNotificationBar', v)}
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
                    {/* Background Image URL */}
                    <div className={`py-2 border-b border-dashed border-muted last:border-0 ${isConfigEditMode ? 'flex justify-between items-center' : 'grid grid-cols-2'}`}>
                      <span className="text-sm text-muted-foreground flex items-center">Background Image</span>
                      {!isConfigEditMode ? (
                        <div className="flex items-center justify-end gap-2">
                           <span className="text-sm font-medium text-right truncate max-w-[200px]">
                             {deviceConfig.backgroundImageUrl ? deviceConfig.backgroundImageUrl : 'Not Set'}
                           </span>
                           {deviceConfig.backgroundImageUrl && (
                             <Button
                               variant="ghost"
                               size="sm"
                               className="h-6 w-6 p-0"
                               onClick={() => {
                                 if (deviceConfig.backgroundImageUrl) {
                                   window.open(deviceConfig.backgroundImageUrl, '_blank');
                                 }
                               }}
                             >
                               <Eye className="h-4 w-4" />
                             </Button>
                           )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                           <label className="relative inline-flex items-center cursor-pointer" title={isBackgroundImageEnabled ? "Disable" : "Enable"}>
                              <input
                                type="checkbox"
                                checked={isBackgroundImageEnabled}
                                onChange={(e) => {
                                  setIsBackgroundImageEnabled(e.target.checked);
                                  if (!e.target.checked) {
                                    handleConfigInputChange('backgroundImageUrl', '');
                                  }
                                }}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                           </label>

                           {isBackgroundImageEnabled && (
                             <>
                               <input
                                 type="text"
                                 value={configFormData.backgroundImageUrl || ''}
                                 onChange={(e) => handleConfigInputChange('backgroundImageUrl', e.target.value)}
                                 placeholder="Image URL"
                                 className="h-8 w-48 rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                               />
                               {configFormData.backgroundImageUrl && (
                                 <Button
                                   variant="ghost"
                                   size="sm"
                                   className="h-8 w-8 p-0"
                                   onClick={() => window.open(configFormData.backgroundImageUrl, '_blank')}
                                   title="View Image"
                                 >
                                   <Eye className="h-4 w-4" />
                                 </Button>
                               )}
                             </>
                           )}
                        </div>
                      )}
                    </div>
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
                      onChange={(v) => {
                        handleConfigInputChange('enableScreenLock', v);
                        if (!v) {
                          handleConfigInputChange('devicePassword', '');
                        }
                      }}
                      type="checkbox"
                    />
                    {(configFormData.enableScreenLock || (deviceConfig.enableScreenLock && isConfigEditMode)) && (
                      <ConfigEditItem
                        label="Device Password"
                        value={deviceConfig.unlockPassword ? '********' : 'Not set'}
                        editValue={configFormData.devicePassword || ''}
                        isEditMode={isConfigEditMode}
                        onChange={(v) => handleConfigInputChange('devicePassword', v)}
                        type="text"
                      />
                    )}
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
