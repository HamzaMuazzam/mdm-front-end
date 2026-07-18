import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { DevicePolicyModal } from './DevicePolicyModal';
import { BulkRootPolicyModal } from './BulkRootPolicyModal';
import { BulkOsUpgradeModal } from './BulkOsUpgradeModal';
import { BulkVpnModal } from './BulkVpnModal';
import { BulkSslPinningModal } from './BulkSslPinningModal';
import { BulkConfigModal, type BulkConfigSection } from './BulkConfigModal';
import { BulkHeartbeatModal } from './BulkHeartbeatModal';
import { BulkResetOptionsLockModal } from './BulkResetOptionsLockModal';
import { BulkAppBlockModal } from './BulkAppBlockModal';
import { ScreenMirroringModal } from './ScreenMirroringModal';
import { BulkActionsMenu } from './BulkActionsMenu';
import { DeviceActionsMenu, type DeviceActionCategory, type ActionTone } from './DeviceActionsMenu';
import { DeviceConfigPanel } from './DeviceConfigPanel';
import { Settings, MapPin, Bell, Smartphone, Monitor, Lock, X, Check, AlertCircle, Pencil, Save, AppWindow, Key, FileText, QrCode, Download, BarChart3, Power, RotateCcw, Siren, Mic, Database, Map, Plus, RefreshCw, Search, Clock, CheckSquare, Square, Users, ShieldAlert, ShieldOff, ArrowUpCircle, Globe, Wifi, MonitorPlay, Activity, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { timeRangeService } from '@/api/services/timerange.service';
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
  const [userCode, setUserCode] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isToggleDialogOpen, setIsToggleDialogOpen] = useState(false);
  const [isCommandDialogOpen, setIsCommandDialogOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isConfigEditMode, setIsConfigEditMode] = useState(false);
  const [isBackgroundImageEnabled, setIsBackgroundImageEnabled] = useState(false);
  const [alertStatusByDevice, setAlertStatusByDevice] = useState<Record<number, boolean>>({});
  const [alertStatusLoading, setAlertStatusLoading] = useState<Record<number, boolean>>({});
  const [deviceToToggle, setDeviceToToggle] = useState<Device | null>(null);
  const [commandTarget, setCommandTarget] = useState<{ device: Device; command: DeviceCommandType } | null>(null);
  const [isCommandSending, setIsCommandSending] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [configDeviceId, setConfigDeviceId] = useState<number | null>(null);
  const [configFormData, setConfigFormData] = useState<UpdateDeviceConfigurationRequest>({});
  const [verificationCodeModal, setVerificationCodeModal] = useState<{ code: number | null } | null>(null);

  // ── Bulk Time Range modal state ───────────────────────────────────────────
  const [isBulkTimeRangeOpen, setIsBulkTimeRangeOpen] = useState(false);

  // ── Update & Security Policy modal state ──────────────────────────────────
  const [policyModalDevice, setPolicyModalDevice] = useState<Device | null>(null);
  const [isBulkRootOpen, setIsBulkRootOpen] = useState(false);
  const [isBulkResetOptionsOpen, setIsBulkResetOptionsOpen] = useState(false);
  const [isBulkOsOpen, setIsBulkOsOpen] = useState(false);
  const [isBulkVpnOpen, setIsBulkVpnOpen] = useState(false);
  const [isBulkSslOpen, setIsBulkSslOpen] = useState(false);
  const [isBulkHeartbeatOpen, setIsBulkHeartbeatOpen] = useState(false);
  const [isBulkAppBlockOpen, setIsBulkAppBlockOpen] = useState(false);
  const [bulkConfigSection, setBulkConfigSection] = useState<BulkConfigSection | null>(null);
  const [screenMirrorDevice, setScreenMirrorDevice] = useState<Device | null>(null);
  const [bulkSelectedUuids, setBulkSelectedUuids] = useState<Set<string>>(new Set());
  const [bulkSearchQuery, setBulkSearchQuery] = useState('');
  const [bulkStartTime, setBulkStartTime] = useState('09:00');
  const [bulkEndTime, setBulkEndTime] = useState('17:00');
  const [bulkTimezone, setBulkTimezone] = useState('device');
  const [bulkEnabled, setBulkEnabled] = useState(true);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ success: number; failed: number } | null>(null);

  const hasPermission = usePermissionStore((state) => state.hasPermission);
  const { data: devices = [], isLoading, refetch: refetchDevices, isFetching } = useDevicesQuery();
  const [searchQuery, setSearchQuery] = useState('');
  const filteredDevices = searchQuery.trim()
    ? devices.filter((d) => {
        const q = searchQuery.toLowerCase();
        return (
          d.deviceName?.toLowerCase().includes(q) ||
          d.deviceUuid?.toLowerCase().includes(q) ||
          d.userEmail?.toLowerCase().includes(q) ||
          d.model?.toLowerCase().includes(q) ||
          d.description?.toLowerCase().includes(q)
        );
      })
    : devices;

  // ── Column sorting ─────────────────────────────────────────────────────────
  type SortKey = 'live' | 'device' | 'user' | 'model' | 'description';
  type SortDir = 'asc' | 'desc';
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      // asc → desc → unsorted (back to default order)
      if (sortDir === 'asc') {
        setSortDir('desc');
      } else {
        setSortKey(null);
        setSortDir('asc');
      }
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedDevices = useMemo(() => {
    if (!sortKey) return filteredDevices;

    const liveRank = (d: Device): number => {
      const status = deviceStatuses[d.deviceUuid];
      const isOffline = status === 'offline' || (status == null && d.online === false);
      // online first when ascending
      return isOffline ? 1 : 0;
    };
    const valueFor = (d: Device): string | number => {
      switch (sortKey) {
        case 'live': return liveRank(d);
        case 'device': return (d.deviceName || d.deviceUuid || '').toLowerCase();
        case 'user': return (d.userEmail || '').toLowerCase();
        case 'model': return (d.model || '').toLowerCase();
        case 'description': return (d.description || '').toLowerCase();
        default: return '';
      }
    };

    const dir = sortDir === 'asc' ? 1 : -1;
    // Copy first — never mutate the query cache array in place.
    return [...filteredDevices].sort((a, b) => {
      const av = valueFor(a);
      const bv = valueFor(b);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * dir;
    });
  }, [filteredDevices, sortKey, sortDir, deviceStatuses]);
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

  // Load userCode from localStorage and generate QR on mount
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        const code = user.userCode || '';
        setUserCode(code);
        if (code) {
          QRCode.toDataURL(code, {
            width: 300,
            margin: 2,
            color: { dark: '#000000', light: '#ffffff' },
            errorCorrectionLevel: 'H',
          }).then(setQrDataUrl).catch(() => setQrDataUrl(''));
        }
      } catch {
        setUserCode('');
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
        bluetoothStateId: deviceConfig.bluetoothStateId,
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
        strictAirplaneMode: deviceConfig.strictAirplaneMode ?? true,
        factoryResetLock: deviceConfig.factoryResetLock ?? true,
        networkResetLock: deviceConfig.networkResetLock ?? true,
        appsControlLock: deviceConfig.appsControlLock ?? false,
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

  const handleTracking = (device: Device) => {
    navigate(`/device/${device.id}/tracking`);
  };

  const handleSimChanges = (device: Device) => {
    navigate(`/device/${device.id}/sim-changes`);
  };

  const handleIntegrity = (device: Device) => {
    navigate(`/device/${device.id}/integrity`);
  };

  const handleDevicePolicy = (device: Device) => {
    setPolicyModalDevice(device);
  };

  const handleSslPinning = (device: Device) => {
    navigate(`/device/${device.id}/ssl-pinning`);
  };

  const handleSosHistory = (device: Device) => {
    navigate(`/device/${device.id}/sos`);
  };

  const handleTimeRange = (device: Device) => {
    navigate(`/device/${device.deviceUuid}/time-range`);
  };

  // ── Bulk Time Range handlers ─────────────────────────────────────────────

  const openBulkTimeRange = () => {
    setBulkSelectedUuids(new Set());
    setBulkSearchQuery('');
    setBulkStartTime('09:00');
    setBulkEndTime('17:00');
    setBulkTimezone('device');
    setBulkEnabled(true);
    setBulkResult(null);
    setIsBulkTimeRangeOpen(true);
  };

  const bulkFilteredDevices = bulkSearchQuery.trim()
    ? devices.filter((d: Device) => {
        const q = bulkSearchQuery.toLowerCase();
        return (
          d.deviceName?.toLowerCase().includes(q) ||
          d.deviceUuid?.toLowerCase().includes(q) ||
          d.userEmail?.toLowerCase().includes(q) ||
          d.model?.toLowerCase().includes(q)
        );
      })
    : devices;

  const toggleBulkDevice = (uuid: string) => {
    setBulkSelectedUuids((prev) => {
      const next = new Set(prev);
      next.has(uuid) ? next.delete(uuid) : next.add(uuid);
      return next;
    });
  };

  const toggleBulkSelectAll = () => {
    if (bulkSelectedUuids.size === bulkFilteredDevices.length) {
      setBulkSelectedUuids(new Set());
    } else {
      setBulkSelectedUuids(new Set(bulkFilteredDevices.map((d: Device) => d.deviceUuid)));
    }
  };

  const handleBulkApply = async () => {
    if (bulkSelectedUuids.size === 0) return;
    setBulkSaving(true);
    setBulkResult(null);
    try {
      const results = await timeRangeService.bulkAssign({
        deviceUuids: Array.from(bulkSelectedUuids),
        startTime: bulkStartTime,
        endTime: bulkEndTime,
        timezone: bulkTimezone,
        enabled: bulkEnabled,
      });
      setBulkResult({ success: results.length, failed: bulkSelectedUuids.size - results.length });
    } catch {
      setBulkResult({ success: 0, failed: bulkSelectedUuids.size });
    } finally {
      setBulkSaving(false);
    }
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

  const handleOpenCommandDialog = (device: Device, command: DeviceCommandType) => {
    setCommandTarget({ device, command });
    setIsCommandDialogOpen(true);
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
    setVerificationCodeModal({ code: code ?? null });
  };

  /**
   * Declarative two-level action model for a device, shared by the desktop dropdown and the mobile
   * sheet. New per-device features slot into the right category here — no menu markup to touch.
   */
  const buildDeviceActionCategories = (device: Device): DeviceActionCategory[] => {
    const isActive = !device.deletedAt;
    const alertsEnabled = alertStatusByDevice[device.id];
    const alertsLoading = alertStatusLoading[device.id];
    const alertsLabel = alertsEnabled === undefined ? 'Alerts' : alertsEnabled ? 'Alerts Enabled' : 'Alerts Disabled';
    const alertsTone: ActionTone = alertsEnabled ? 'green' : alertsEnabled === false ? 'amber' : 'default';

    return [
      {
        key: 'monitoring',
        label: 'Monitoring',
        icon: BarChart3,
        items: [
          { key: 'monitor', label: 'Monitor Dashboard', icon: BarChart3, onSelect: () => handleOpenMonitorDashboard(device), visible: hasPermission('devices:monitoring') },
          { key: 'screen', label: 'Screen Mirroring', icon: MonitorPlay, tone: 'blue', onSelect: () => setScreenMirrorDevice(device), visible: hasPermission('devices:monitoring') },
          { key: 'config', label: 'Configuration', icon: Settings, onSelect: () => handleViewConfig(device), visible: hasPermission('devices:configurations:read') },
          { key: 'apps', label: 'Applications', icon: AppWindow, onSelect: () => handleViewApps(device), visible: hasPermission('devices:applications:read') },
          { key: 'requests', label: 'Requests', icon: FileText, onSelect: () => handleViewRequests(device) },
          { key: 'notifications', label: 'Notifications', icon: Bell, onSelect: () => handleViewNotifications(device), visible: hasPermission('notifications:view-history') },
          { key: 'data', label: 'Contacts, SMS & Calls', icon: Database, tone: 'blue', onSelect: () => handleMonitorData(device), visible: hasPermission('device-data:read') || hasPermission('contacts:read') || hasPermission('sms:read') || hasPermission('call-logs:read') },
          { key: 'listen', label: 'Listen to Device', icon: Mic, tone: 'green', onSelect: () => handleListenAudio(device), visible: hasPermission('device-audio:listen') || hasPermission('audio-management:listen') },
          { key: 'sim', label: 'SIM Change Logs', icon: Smartphone, tone: 'blue', onSelect: () => handleSimChanges(device), visible: hasPermission('sim-changes:read') },
        ],
      },
      {
        key: 'security',
        label: 'Security & Policy',
        icon: ShieldAlert,
        items: [
          { key: 'integrity', label: 'Root / Integrity', icon: ShieldAlert, tone: 'red', onSelect: () => handleIntegrity(device), visible: hasPermission('device-integrity:read') },
          { key: 'policy', label: 'Update & Security Policy', icon: Settings, tone: 'blue', onSelect: () => handleDevicePolicy(device), visible: hasPermission('configuration:update') },
          { key: 'ssl', label: 'SSL Pinning', icon: Lock, tone: 'blue', onSelect: () => handleSslPinning(device), visible: hasPermission('configuration:update') },
        ],
      },
      {
        key: 'location',
        label: 'Location & Safety',
        icon: MapPin,
        items: [
          { key: 'tracking', label: 'Live Tracking', icon: MapPin, tone: 'blue', onSelect: () => handleTracking(device), visible: hasPermission('tracking:history') },
          { key: 'sos', label: 'SOS History', icon: Siren, tone: 'red', onSelect: () => handleSosHistory(device), visible: hasPermission('tracking:history') },
          { key: 'alarm', label: 'Send Alarm', icon: Siren, tone: 'red', onSelect: () => handleSendAlert(device), visible: hasPermission('device-alerts:send') },
        ],
      },
      {
        key: 'access',
        label: 'Access & Settings',
        icon: Key,
        items: [
          { key: 'code', label: 'Verification Code', icon: Key, onSelect: () => handleShowCode(device.deviceVerificationCode) },
          { key: 'alerts', label: alertsLabel, icon: Bell, tone: alertsTone, disabled: alertsLoading || updateNotificationSettingsMutation.isPending, onSelect: () => handleToggleAlerts(device), visible: hasPermission('notifications:manage-alerts') },
          { key: 'timerange', label: 'Usage Time Range', icon: Clock, tone: 'blue', onSelect: () => handleTimeRange(device) },
          { key: 'edit', label: 'Edit Device', icon: Pencil, onSelect: () => handleEdit(device), visible: hasPermission('devices:update') },
        ],
      },
      {
        key: 'danger',
        label: 'Danger Zone',
        icon: AlertCircle,
        items: [
          { key: 'reboot', label: 'Reboot', icon: Power, onSelect: () => handleOpenCommandDialog(device, 'reboot'), visible: hasPermission('devices:update') },
          { key: 'reset', label: 'Factory Reset', icon: RotateCcw, tone: 'red', onSelect: () => handleOpenCommandDialog(device, 'reset'), visible: hasPermission('devices:update') },
          { key: 'toggle', label: isActive ? 'Deactivate Device' : 'Activate Device', icon: isActive ? AlertCircle : Check, tone: isActive ? 'red' : 'green', disabled: toggleStatusMutation.isPending, onSelect: () => handleToggleClick(device), visible: hasPermission('devices:delete') },
        ],
      },
    ];
  };

  if (isLoading) {
    return <div>Loading devices...</div>;
  }

  // Flat muted palette for device avatars (cycles by device id)
  const avatarGradients = [
    'bg-blue-100 text-blue-700',
    'bg-gray-200 text-gray-700',
    'bg-blue-50 text-blue-600',
    'bg-gray-100 text-gray-600',
    'bg-blue-100 text-blue-800',
    'bg-gray-200 text-gray-600',
  ];

  return (
    <div className="flex h-full flex-col">
      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start mb-4 sm:mb-6">
        {/* Mobile: icon + title stacked */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 rounded-md sm:hidden">
            <Smartphone className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold text-gray-900">Device Management</h1>
              {devices.length > 0 && (() => {
                const liveCount    = devices.filter((d) => deviceStatuses[d.deviceUuid] === 'online').length;
                const offlineCount = devices.length - liveCount;
                const rootedCount  = devices.filter((d) => d.integrityCompromised).length;
                const atRiskCount  = devices.filter((d) => !d.integrityCompromised && d.integrityStatus === 'SUSPICIOUS').length;
                // OTA rollout: only meaningful when at least one active release exists
                const hasRelease     = devices.some((d) => d.latestAppVersionCode != null);
                const updatedCount   = devices.filter((d) => d.appUpToDate === true).length;
                const outdatedCount  = devices.filter((d) => d.appUpToDate === false).length;
                const unreportedCount = devices.filter((d) => d.appUpToDate == null).length;
                const simCount     = devices.filter((d) => d.simAlert).length;
                return (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {devices.length} total
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-xs font-medium text-green-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
                      {liveCount} live
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0" />
                      {offlineCount} offline
                    </span>
                    {rootedCount > 0 && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-xs font-medium text-red-700"
                        title="Devices with a confirmed working root (conclusive evidence)"
                      >
                        <ShieldAlert className="h-3 w-3 shrink-0" />
                        {rootedCount} rooted
                      </span>
                    )}
                    {atRiskCount > 0 && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-orange-50 border border-orange-200 px-2 py-0.5 text-xs font-medium text-orange-700"
                        title="Devices with dangerous integrity indicators (su/Magisk files, SELinux permissive, unlocked bootloader) — not confirmed rooted"
                      >
                        <ShieldAlert className="h-3 w-3 shrink-0" />
                        {atRiskCount} at risk
                      </span>
                    )}
                    {simCount > 0 && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-700"
                        title="Devices with a recent SIM removal / swap alert"
                      >
                        {simCount} SIM alert{simCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    {hasRelease && (
                      <>
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-medium text-emerald-700"
                          title="Devices running the latest uploaded app release"
                        >
                          {updatedCount} updated
                        </span>
                        {outdatedCount > 0 && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-700"
                            title="Devices still running an older app version than the latest release"
                          >
                            {outdatedCount} outdated
                          </span>
                        )}
                        {unreportedCount > 0 && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600"
                            title="Devices that have not reported their app version yet (waiting for next device sync)"
                          >
                            {unreportedCount} no version yet
                          </span>
                        )}
                      </>
                    )}
                  </div>
                );
              })()}
              <button
                type="button"
                onClick={() => refetchDevices()}
                disabled={isFetching}
                title="Refresh devices"
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 sm:hidden">{devices.length} device{devices.length !== 1 ? 's' : ''} registered</p>
            {/* Search — full width on mobile, constrained on desktop */}
            <div className="relative mt-2 w-full sm:w-56 lg:w-72">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search devices…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-8 pr-8 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={() => setIsQrModalOpen(true)} className="flex-1 sm:flex-none">
            <QrCode className="h-4 w-4 mr-2" />
            QR View
          </Button>
          {hasPermission('tracking:history') && devices.length > 0 && (
            <Button
              variant="outline"
              onClick={() => window.open('/devices/track-all', '_blank')}
              className="flex-1 sm:flex-none border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300"
            >
              <Map className="h-4 w-4 mr-2" />
              Track All
            </Button>
          )}
          {devices.length > 0 && (
            <BulkActionsMenu
              groups={[
                {
                  label: 'Security',
                  items: [
                    {
                      label: 'Root / Compromise',
                      icon: ShieldAlert,
                      onClick: () => setIsBulkRootOpen(true),
                      visible: hasPermission('configuration:update'),
                    },
                    {
                      label: 'SSL Pinning',
                      icon: Lock,
                      onClick: () => setIsBulkSslOpen(true),
                      visible: hasPermission('configuration:update'),
                    },
                    {
                      label: 'Reset Options Lock',
                      icon: ShieldOff,
                      onClick: () => setIsBulkResetOptionsOpen(true),
                      visible: hasPermission('configuration:update'),
                    },
                  ],
                },
                {
                  label: 'Applications',
                  items: [
                    {
                      label: 'App Block / Unblock',
                      icon: AppWindow,
                      onClick: () => setIsBulkAppBlockOpen(true),
                      visible: hasPermission('devices:applications:read'),
                    },
                  ],
                },
                {
                  label: 'Updates',
                  items: [
                    {
                      label: 'OS Upgrade Policy',
                      icon: ArrowUpCircle,
                      onClick: () => setIsBulkOsOpen(true),
                      visible: hasPermission('configuration:update'),
                    },
                  ],
                },
                {
                  label: 'Network',
                  items: [
                    {
                      label: 'VPN',
                      icon: Globe,
                      onClick: () => setIsBulkVpnOpen(true),
                      visible: hasPermission('configuration:update'),
                    },
                  ],
                },
                {
                  label: 'Configuration',
                  items: [
                    { label: 'Connectivity', icon: Wifi, onClick: () => setBulkConfigSection('connectivity'), visible: hasPermission('configuration:update') },
                    { label: 'Display & Screen', icon: Monitor, onClick: () => setBulkConfigSection('display'), visible: hasPermission('configuration:update') },
                    { label: 'Security & Controls', icon: Lock, onClick: () => setBulkConfigSection('security'), visible: hasPermission('configuration:update') },
                    { label: 'Notifications & More', icon: Bell, onClick: () => setBulkConfigSection('notifications'), visible: hasPermission('configuration:update') },
                  ],
                },
                {
                  label: 'Tracking',
                  items: [
                    {
                      label: 'Heartbeat Timer',
                      icon: Activity,
                      onClick: () => setIsBulkHeartbeatOpen(true),
                      visible: hasPermission('tracking:live-tracking'),
                    },
                  ],
                },
                {
                  label: 'Usage',
                  items: [{ label: 'Time Range', icon: Clock, onClick: openBulkTimeRange }],
                },
              ]}
            />
          )}
          {hasPermission('devices:create') && (
            <Button onClick={() => setIsModalOpen(true)} className="flex-1 sm:flex-none shadow-sm">
              <Plus className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Add Device</span>
            </Button>
          )}
        </div>
      </div>

      {/* ── Mobile: beautiful card list (hidden on sm+) ─────────── */}
      <div className="flex flex-col gap-3 sm:hidden pb-4">
        {filteredDevices.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mb-3">
              <Smartphone className="h-8 w-8 text-muted-foreground" />
            </div>
            {searchQuery.trim() ? (
              <>
                <p className="font-medium text-foreground mb-1">No results for "{searchQuery}"</p>
                <p className="text-sm text-muted-foreground text-center">Try a different name, UUID, or email.</p>
              </>
            ) : (
              <>
                <p className="font-medium text-foreground mb-1">No Devices Found</p>
                <p className="text-sm text-muted-foreground text-center">Add your first device to get started.</p>
              </>
            )}
          </div>
        )}
        {filteredDevices.map((device: Device) => {
          const isActive = !device.deletedAt;
          const onlineStatus = deviceStatuses[device.deviceUuid];
          const isOffline = onlineStatus === 'offline' || (onlineStatus == null && device.online === false);
          const gradient = avatarGradients[device.id % avatarGradients.length];
          // Left border: green if active+online, amber if active+offline/unknown, red if inactive
          const accentClass = !isActive
            ? 'border-l-red-500'
            : onlineStatus === 'online'
            ? 'border-l-green-500'
            : 'border-l-amber-400';

          return (
            <div
              key={device.id}
              className={`rounded-lg border border-gray-200 border-l-4 ${accentClass} bg-white shadow-sm overflow-hidden${!isActive ? ' opacity-70' : ''}`}
            >
              {/* ── Card header: avatar + info + status badge ── */}
              <div className="flex items-start gap-3 p-4 pb-3">
                {/* Avatar with live-status overlay */}
                <div className="relative shrink-0">
                  <div className={`w-12 h-12 rounded-full ${gradient} flex items-center justify-center`}>
                    <span className="font-semibold text-lg leading-none">
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
                    <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                      isActive
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-500' : 'bg-red-500'}`} />
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
                  {device.appVersionName != null && (
                    <p className="text-[11px] mt-0.5">
                      <span className="text-muted-foreground/80">
                        App v{device.appVersionName}
                        {device.appVersionCode != null ? ` (${device.appVersionCode})` : ''}
                      </span>{' '}
                      {device.appUpToDate === true && (
                        <span className="font-semibold text-emerald-600">· up to date</span>
                      )}
                      {device.appUpToDate === false && (
                        <span
                          className="font-semibold text-amber-600"
                          title={`Latest release is version code ${device.latestAppVersionCode}`}
                        >
                          · update pending
                        </span>
                      )}
                    </p>
                  )}
                  {device.description && (
                    <p className="text-[11px] text-muted-foreground/60 italic truncate mt-0.5">{device.description}</p>
                  )}
                  {/* Security flags — mirrors the desktop table chips */}
                  {(device.integrityCompromised || device.integrityStatus === 'SUSPICIOUS' || device.simAlert) && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      {device.integrityCompromised && (
                        <span
                          className="inline-flex items-center gap-0.5 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600"
                          title={`Integrity: ${device.integrityStatus ?? 'COMPROMISED'}${device.integritySeverity ? ` (${device.integritySeverity})` : ''}`}
                        >
                          <ShieldAlert className="h-3 w-3" /> Rooted
                        </span>
                      )}
                      {!device.integrityCompromised && device.integrityStatus === 'SUSPICIOUS' && (
                        <span
                          className="inline-flex items-center gap-0.5 rounded bg-orange-50 px-1.5 py-0.5 text-[10px] font-semibold text-orange-600"
                          title={`Integrity: SUSPICIOUS${device.integritySeverity ? ` (${device.integritySeverity})` : ''} — dangerous indicators, not confirmed rooted`}
                        >
                          <ShieldAlert className="h-3 w-3" /> At risk
                        </span>
                      )}
                      {device.simAlert && (
                        <span
                          className="inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700"
                          title={`SIM ${device.simEventType ?? 'change'}`}
                        >
                          SIM {device.simEventType === 'REMOVED' ? 'removed' : device.simEventType === 'SWAPPED' ? 'swapped' : 'alert'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ── UUID meta row ── */}
              <div className="border-t border-border/50 bg-muted/30 px-4 py-2 flex items-center gap-2">
                <Monitor className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                <p className="text-[11px] font-mono text-muted-foreground truncate">{device.deviceUuid}</p>
                {isOffline && device.lastSeenAt ? (
                  <span className="ml-auto shrink-0 text-[10px] text-muted-foreground/70 whitespace-nowrap">
                    Last seen {timeAgo(device.lastSeenAt)}
                  </span>
                ) : null}
              </div>

              {/* ── Quick action buttons ── */}
              <div className="border-t border-border/50 px-2 py-1.5 flex flex-wrap items-center gap-0.5">
                {hasPermission('devices:monitoring') && (
                  <button
                    type="button"
                    onClick={() => handleOpenMonitorDashboard(device)}
                    className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
                  >
                    <BarChart3 className="h-4 w-4" />
                    <span className="text-[10px] font-medium">Monitor</span>
                  </button>
                )}
                {hasPermission('devices:applications:read') && (
                  <button
                    type="button"
                    onClick={() => handleViewApps(device)}
                    className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
                  >
                    <AppWindow className="h-4 w-4" />
                    <span className="text-[10px] font-medium">Apps</span>
                  </button>
                )}
                {hasPermission('devices:update') && (
                  <button
                    type="button"
                    onClick={() => handleEdit(device)}
                    className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
                  >
                    <Pencil className="h-4 w-4" />
                    <span className="text-[10px] font-medium">Edit</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleViewRequests(device)}
                  className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
                >
                  <FileText className="h-4 w-4" />
                  <span className="text-[10px] font-medium">Requests</span>
                </button>
                {hasPermission('notifications:view-history') && (
                  <button
                    type="button"
                    onClick={() => handleViewNotifications(device)}
                    className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
                  >
                    <Bell className="h-4 w-4" />
                    <span className="text-[10px] font-medium">Notifications</span>
                  </button>
                )}
                {hasPermission('notifications:manage-alerts') && (
                  <button
                    type="button"
                    onClick={() => handleToggleAlerts(device)}
                    className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
                  >
                    <Bell className="h-4 w-4" />
                    <span className="text-[10px] font-medium">Alerts</span>
                  </button>
                )}
                {hasPermission('device-alerts:send') && (
                  <button
                    type="button"
                    onClick={() => handleSendAlert(device)}
                    className="flex flex-col items-center gap-0.5 px-2.5 py-2 rounded-md bg-red-600 hover:bg-red-700 active:bg-red-800 transition-colors text-white"
                  >
                    <Siren className="h-4 w-4" />
                    <span className="text-[10px] font-semibold">Send Alarm</span>
                  </button>
                )}

                {(hasPermission('device-audio:listen') || hasPermission('audio-management:listen')) && (
                  <button
                    type="button"
                    onClick={() => handleListenAudio(device)}
                    className="flex flex-col items-center gap-0.5 px-2.5 py-2 rounded-md bg-green-600 hover:bg-green-700 active:bg-green-800 transition-colors text-white"
                  >
                    <Mic className="h-4 w-4" />
                    <span className="text-[10px] font-semibold">Listen</span>
                  </button>
                )}
                {(hasPermission('device-data:read') || hasPermission('contacts:read') || hasPermission('sms:read') || hasPermission('call-logs:read')) && (
                  <button
                    type="button"
                    onClick={() => handleMonitorData(device)}
                    className="flex flex-col items-center gap-0.5 px-2.5 py-2 rounded-md bg-blue-600 hover:bg-blue-700 active:bg-blue-800 transition-colors text-white"
                  >
                    <Database className="h-4 w-4" />
                    <span className="text-[10px] font-semibold">Data</span>
                  </button>
                )}
                {hasPermission('tracking:history') && (
                  <button
                    type="button"
                    onClick={() => handleTracking(device)}
                    className="flex flex-col items-center gap-0.5 px-2.5 py-2 rounded-md bg-blue-600 hover:bg-blue-700 active:bg-blue-800 transition-colors text-white"
                  >
                    <MapPin className="h-4 w-4" />
                    <span className="text-[10px] font-semibold">Tracking</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleTimeRange(device)}
                  className="flex flex-col items-center gap-0.5 px-2.5 py-2 rounded-md bg-blue-600 hover:bg-blue-700 active:bg-blue-800 transition-colors text-white"
                >
                  <Clock className="h-4 w-4" />
                  <span className="text-[10px] font-semibold">Time Range</span>
                </button>

                {/* Overflow menu */}
                <DeviceActionsMenu
                  variant="sheet"
                  device={device}
                  categories={buildDeviceActionCategories(device)}
                  onOpen={() => void fetchAlertStatus(device.id)}
                />
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
              <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/80 backdrop-blur">
                <tr className="text-[11px] uppercase tracking-wider text-gray-400 [&>th]:px-3 [&>th]:py-2.5 [&>th]:font-semibold">
                  <SortableTh label="Live" sortKey="live" activeKey={sortKey} dir={sortDir} onSort={toggleSort} align="center" className="w-12" />
                  <SortableTh label="Device" sortKey="device" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortableTh label="User" sortKey="user" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortableTh label="Model / OS" sortKey="model" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortableTh label="Description" sortKey="description" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                  <th className="w-16 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedDevices.map((device:Device) => {
                  const isActive = !device.deletedAt;
                  const liveStatus = deviceStatuses[device.deviceUuid];
                  const isOffline = liveStatus === 'offline' || (liveStatus == null && device.online === false);
                  return (
                    <tr
                      key={device.id}
                      className={`group transition-colors hover:bg-blue-50/40 [&>td]:px-3 [&>td]:py-2 [&>td]:align-middle ${!isActive ? 'bg-gray-50 opacity-60 hover:opacity-100' : ''}`}
                    >
                      <td className="w-12 text-center">
                        <DeviceStatusDot status={deviceStatuses[device.deviceUuid]} />
                      </td>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${isActive ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                            <Smartphone className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className={`truncate text-[13px] font-medium ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                                {device.deviceName || 'Unnamed Device'}
                              </p>
                              {device.integrityCompromised && (
                                <span
                                  className="inline-flex shrink-0 items-center gap-0.5 rounded bg-red-50 px-1 py-0.5 text-[10px] font-semibold text-red-600"
                                  title={`Integrity: ${device.integrityStatus ?? 'COMPROMISED'}${device.integritySeverity ? ` (${device.integritySeverity})` : ''}`}
                                >
                                  <ShieldAlert className="h-3 w-3" /> Rooted
                                </span>
                              )}
                              {!device.integrityCompromised && device.integrityStatus === 'SUSPICIOUS' && (
                                <span
                                  className="inline-flex shrink-0 items-center gap-0.5 rounded bg-orange-50 px-1 py-0.5 text-[10px] font-semibold text-orange-600"
                                  title={`Integrity: SUSPICIOUS${device.integritySeverity ? ` (${device.integritySeverity})` : ''} — dangerous indicators, not confirmed rooted`}
                                >
                                  <ShieldAlert className="h-3 w-3" /> At risk
                                </span>
                              )}
                              {device.simAlert && (
                                <span
                                  className="inline-flex shrink-0 items-center rounded bg-amber-50 px-1 py-0.5 text-[10px] font-semibold text-amber-700"
                                  title={`SIM ${device.simEventType ?? 'change'}`}
                                >
                                  SIM {device.simEventType === 'REMOVED' ? 'removed' : device.simEventType === 'SWAPPED' ? 'swapped' : 'alert'}
                                </span>
                              )}
                            </div>
                            <p className="truncate font-mono text-[11px] text-gray-400" title={device.deviceUuid}>
                              {device.deviceUuid}
                            </p>
                            {isOffline && device.lastSeenAt ? (
                              <p className="truncate text-[10px] text-gray-400">Last seen {timeAgo(device.lastSeenAt)}</p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="block max-w-[220px] truncate text-[13px] text-gray-600" title={device.userEmail || ''}>
                          {device.userEmail || '—'}
                        </span>
                      </td>
                      <td>
                        <div className="min-w-0">
                          <p className="truncate text-[13px] text-gray-700">{device.model || '—'}</p>
                          <p className="truncate text-[11px] text-gray-400">{device.osVersion || '—'}</p>
                          {device.appVersionName != null ? (
                            <p
                              className={`truncate text-[11px] font-medium ${
                                device.appUpToDate === true
                                  ? 'text-emerald-600'
                                  : device.appUpToDate === false
                                    ? 'text-amber-600'
                                    : 'text-gray-500'
                              }`}
                              title={
                                device.appUpToDate === false && device.latestAppVersionCode != null
                                  ? `Outdated — latest release is version code ${device.latestAppVersionCode}`
                                  : device.appUpToDate === true
                                    ? 'Running the latest uploaded release'
                                    : 'Installed app version reported by the device'
                              }
                            >
                              App v{device.appVersionName}
                              {device.appVersionCode != null ? ` (${device.appVersionCode})` : ''}
                              {device.appUpToDate === true ? ' ✓' : device.appUpToDate === false ? ' — outdated' : ''}
                            </p>
                          ) : (
                            <p className="truncate text-[11px] text-gray-300" title="No app version reported yet — waiting for the next device sync">
                              App v —
                            </p>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="block max-w-[220px] truncate text-[13px] text-gray-500" title={device.description || ''}>
                          {device.description || '—'}
                        </span>
                      </td>
                      <td className="w-16 text-right">
                        <DeviceActionsMenu
                          variant="dropdown"
                          device={device}
                          categories={buildDeviceActionCategories(device)}
                          onOpen={() => void fetchAlertStatus(device.id)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Update & Security Policy modals ──────────────────────────────────── */}
      {policyModalDevice && (
        <DevicePolicyModal device={policyModalDevice} onClose={() => setPolicyModalDevice(null)} />
      )}
      {isBulkRootOpen && (
        <BulkRootPolicyModal devices={devices} onClose={() => setIsBulkRootOpen(false)} />
      )}
      {isBulkResetOptionsOpen && (
        <BulkResetOptionsLockModal devices={devices} onClose={() => setIsBulkResetOptionsOpen(false)} />
      )}
      {isBulkOsOpen && (
        <BulkOsUpgradeModal devices={devices} onClose={() => setIsBulkOsOpen(false)} />
      )}
      {isBulkVpnOpen && (
        <BulkVpnModal devices={devices} onClose={() => setIsBulkVpnOpen(false)} />
      )}
      {isBulkSslOpen && (
        <BulkSslPinningModal devices={devices} onClose={() => setIsBulkSslOpen(false)} />
      )}
      {isBulkHeartbeatOpen && (
        <BulkHeartbeatModal devices={devices} onClose={() => setIsBulkHeartbeatOpen(false)} />
      )}
      {isBulkAppBlockOpen && (
        <BulkAppBlockModal devices={devices} onClose={() => setIsBulkAppBlockOpen(false)} />
      )}
      {bulkConfigSection && (
        <BulkConfigModal section={bulkConfigSection} devices={devices} onClose={() => setBulkConfigSection(null)} />
      )}
      {screenMirrorDevice && (
        <ScreenMirroringModal device={screenMirrorDevice} onClose={() => setScreenMirrorDevice(null)} />
      )}

      {/* ── Bulk Time Range Modal ────────────────────────────────────────────── */}
      {isBulkTimeRangeOpen && (
        <div
          className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={() => setIsBulkTimeRangeOpen(false)}
        >
          <div
            className="w-full sm:max-w-2xl rounded-t-lg sm:rounded-lg bg-white border border-gray-200 shadow-lg flex flex-col max-h-[92dvh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-md bg-blue-50">
                  <Clock className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Bulk Time Range</h2>
                  <p className="text-xs text-muted-foreground">Apply the same time range to multiple devices at once</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkTimeRangeOpen(false)}
                className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row flex-1 min-h-0 overflow-hidden">

              {/* Left panel: device selection */}
              <div className="flex flex-col sm:w-80 border-b sm:border-b-0 sm:border-r border-border max-h-64 sm:max-h-none">
                {/* Device search + select all */}
                <div className="px-4 py-3 border-b border-border shrink-0 space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search devices…"
                      value={bulkSearchQuery}
                      onChange={(e) => setBulkSearchQuery(e.target.value)}
                      className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-8 pr-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={toggleBulkSelectAll}
                    className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    {bulkSelectedUuids.size === bulkFilteredDevices.length && bulkFilteredDevices.length > 0
                      ? <CheckSquare className="h-3.5 w-3.5" />
                      : <Square className="h-3.5 w-3.5" />}
                    {bulkSelectedUuids.size === bulkFilteredDevices.length && bulkFilteredDevices.length > 0
                      ? 'Deselect all'
                      : `Select all (${bulkFilteredDevices.length})`}
                  </button>
                </div>

                {/* Device list */}
                <div className="flex-1 overflow-y-auto divide-y divide-border">
                  {bulkFilteredDevices.length === 0 ? (
                    <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                      No devices found
                    </div>
                  ) : (
                    bulkFilteredDevices.map((device: Device) => {
                      const selected = bulkSelectedUuids.has(device.deviceUuid);
                      const online   = deviceStatuses[device.deviceUuid] === 'online';
                      return (
                        <button
                          key={device.deviceUuid}
                          type="button"
                          onClick={() => toggleBulkDevice(device.deviceUuid)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                            selected ? 'bg-blue-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className={`shrink-0 h-4 w-4 rounded border-2 flex items-center justify-center transition-colors ${
                            selected
                              ? 'bg-blue-600 border-blue-600'
                              : 'border-gray-300 bg-white'
                          }`}>
                            {selected && <Check className="h-2.5 w-2.5 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {device.deviceName || 'Unnamed Device'}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {device.userEmail || device.deviceUuid}
                            </p>
                          </div>
                          <span className={`shrink-0 h-2 w-2 rounded-full ${online ? 'bg-green-500' : 'bg-gray-400'}`} />
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Selection count */}
                <div className="px-4 py-2.5 border-t border-border bg-muted/30 shrink-0">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    <span>
                      <span className="font-semibold text-foreground">{bulkSelectedUuids.size}</span> device{bulkSelectedUuids.size !== 1 ? 's' : ''} selected
                    </span>
                  </p>
                </div>
              </div>

              {/* Right panel: time range config */}
              <div className="flex flex-col flex-1 min-h-0">
                <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

                  {/* Time pickers */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Start Time (allowed from)
                      </label>
                      <input
                        type="time"
                        value={bulkStartTime}
                        onChange={(e) => setBulkStartTime(e.target.value)}
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        End Time (lock after)
                      </label>
                      <input
                        type="time"
                        value={bulkEndTime}
                        onChange={(e) => setBulkEndTime(e.target.value)}
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>

                  {/* Midnight-crossing hint */}
                  {bulkStartTime > bulkEndTime && (
                    <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
                      Midnight-crossing range: unlocks at {bulkStartTime}, locks at {bulkEndTime} next day.
                    </p>
                  )}

                  {/* Timezone */}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Timezone</label>
                    <select
                      value={bulkTimezone}
                      onChange={(e) => setBulkTimezone(e.target.value)}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {['device','UTC','Asia/Karachi','Asia/Kolkata','Asia/Dubai','America/New_York','America/Los_Angeles','Europe/London','Europe/Berlin','Australia/Sydney'].map((tz) => (
                        <option key={tz} value={tz}>{tz === 'device' ? 'Device local timezone' : tz}</option>
                      ))}
                    </select>
                  </div>

                  {/* Enable toggle */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setBulkEnabled((v) => !v)}
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                        bulkEnabled
                          ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                          : 'border-gray-200 bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {bulkEnabled ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                      {bulkEnabled ? 'Enabled' : 'Disabled'}
                    </button>
                    <span className="text-xs text-muted-foreground">
                      {bulkEnabled ? 'Policy will be enforced immediately on all selected devices.' : 'Config saved but not enforced.'}
                    </span>
                  </div>

                  {/* Result banner */}
                  {bulkResult && (
                    <div className={`rounded-md border px-4 py-3 text-sm flex items-start gap-2 ${
                      bulkResult.failed === 0
                        ? 'bg-green-50 border-green-200 text-green-700'
                        : bulkResult.success === 0
                        ? 'bg-red-50 border-red-200 text-red-700'
                        : 'bg-amber-50 border-amber-200 text-amber-700'
                    }`}>
                      <Check className="h-4 w-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">
                          {bulkResult.failed === 0
                            ? `Time range applied to all ${bulkResult.success} device${bulkResult.success !== 1 ? 's' : ''}.`
                            : `Applied to ${bulkResult.success} device${bulkResult.success !== 1 ? 's' : ''}. ${bulkResult.failed} failed.`}
                        </p>
                        <p className="text-xs opacity-80 mt-0.5">Each device will enforce the policy at the next scheduled transition.</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="shrink-0 px-5 py-4 border-t border-border flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsBulkTimeRangeOpen(false)}
                    className="flex-1 sm:flex-none py-2.5 px-4 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkApply}
                    disabled={bulkSelectedUuids.size === 0 || bulkSaving}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors shadow-sm"
                  >
                    {bulkSaving ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Applying…
                      </>
                    ) : (
                      <>
                        <Clock className="h-4 w-4" />
                        Apply to {bulkSelectedUuids.size} device{bulkSelectedUuids.size !== 1 ? 's' : ''}
                      </>
                    )}
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Verification Code Modal */}
      {verificationCodeModal && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setVerificationCodeModal(null)}>
          <div
            className="w-full sm:max-w-sm rounded-t-lg sm:rounded-lg bg-white border border-gray-200 shadow-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-md bg-blue-50">
                  <Key className="h-4 w-4 text-blue-600" />
                </div>
                <h2 className="text-base font-semibold text-gray-900">Verification Code</h2>
              </div>
              <button
                type="button"
                onClick={() => setVerificationCodeModal(null)}
                className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* Body */}
            <div className="px-5 py-6 flex flex-col items-center gap-3">
              {verificationCodeModal.code != null ? (
                <>
                  <p className="text-sm text-muted-foreground text-center">Use this code to verify the device</p>
                  <div className="w-full rounded-md bg-gray-100 px-6 py-4 flex items-center justify-center">
                    <span className="text-3xl font-bold tracking-[0.25em] text-gray-900 font-mono select-all">
                      {verificationCodeModal.code}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">No verification code available for this device.</p>
              )}
            </div>
            {/* Footer */}
            <div className="px-5 pb-5">
              <button
                type="button"
                onClick={() => setVerificationCodeModal(null)}
                className="w-full py-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Device Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
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
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
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
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
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
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
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
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
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
                  <p className="text-sm font-mono text-muted-foreground">{userCode}</p>
                  <Button onClick={handleDownloadQr}>
                    <Download className="h-4 w-4 mr-2" />
                    Download QR Code
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No user code found. Please log in again.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Device Configuration Modal */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <Card className="w-full sm:max-w-5xl rounded-b-none sm:rounded-lg max-h-[92dvh] overflow-hidden flex flex-col">
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
        bluetoothStateId: deviceConfig.bluetoothStateId,
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
        strictAirplaneMode: deviceConfig.strictAirplaneMode ?? true,
        factoryResetLock: deviceConfig.factoryResetLock ?? true,
        networkResetLock: deviceConfig.networkResetLock ?? true,
        appsControlLock: deviceConfig.appsControlLock ?? false,
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
            <CardContent className="flex min-h-0 flex-1 p-0">
              {isLoadingConfig ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : deviceConfig ? (
                <DeviceConfigPanel
                  deviceConfig={deviceConfig}
                  configFormData={configFormData}
                  isEditMode={isConfigEditMode}
                  onChange={handleConfigInputChange}
                  featureStates={featureStates}
                  locationTrackingTypes={locationTrackingTypes}
                  pushNotificationProtocols={pushNotificationProtocols}
                  permissionGranters={permissionGranters}
                  isBackgroundImageEnabled={isBackgroundImageEnabled}
                  setIsBackgroundImageEnabled={setIsBackgroundImageEnabled}
                />
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center py-12 text-muted-foreground">
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

/** Compact relative-time formatter for "last seen" timestamps (epoch millis). */
/** Clickable table header cell that toggles column sort (asc → desc → none). */
function SortableTh({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  align = 'left',
  className = '',
}: {
  label: string;
  sortKey: 'live' | 'device' | 'user' | 'model' | 'description';
  activeKey: 'live' | 'device' | 'user' | 'model' | 'description' | null;
  dir: 'asc' | 'desc';
  onSort: (key: 'live' | 'device' | 'user' | 'model' | 'description') => void;
  align?: 'left' | 'center' | 'right';
  className?: string;
}) {
  const isActive = activeKey === sortKey;
  const justify = align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start';
  return (
    <th className={`text-${align} ${className}`} aria-sort={isActive ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`group inline-flex items-center gap-1 ${justify} uppercase tracking-wider transition-colors hover:text-gray-700 ${isActive ? 'text-gray-700' : ''}`}
        title={`Sort by ${label}`}
      >
        <span>{label}</span>
        {isActive ? (
          dir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronsUpDown className="h-3 w-3 text-gray-300 group-hover:text-gray-400" />
        )}
      </button>
    </th>
  );
}

function timeAgo(ms?: number | null): string {
  if (!ms) return 'unknown';
  const secs = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function DeviceStatusDot({ status }: { status?: 'online' | 'offline' }) {
  if (!status) {
    // No MQTT event received yet — show grey dot
    return (
      <span className="relative inline-flex h-3 w-3" title="Unknown">
        <span className="h-3 w-3 rounded-full bg-gray-300" />
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
      <span className="h-3 w-3 rounded-full bg-gray-400" />
    </span>
  );
}
