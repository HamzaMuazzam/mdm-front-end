import { useState, useEffect } from 'react';
import type { ComponentType } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParentConfiguration, useUpdateDeviceConfiguration, useApplicationPermissionGranters, useFeatureStates, useLocationTrackingTypes, usePushNotificationProtocols, useVpnProtocolTypes } from '@/hooks/useDevices';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Wifi, MapPin, Bell, Smartphone, Monitor, Lock, Check, X, Pencil, Save, RefreshCw, Eye, ShieldAlert, ArrowUpCircle, Globe, KeyRound, Volume2 } from 'lucide-react';
import type { UpdateDeviceConfigurationRequest } from '@/types/device.types';
import { usePermissionStore } from '@/store/permissionStore';

type TabType = 'configuration' | 'settings';
type SectionId =
  | 'general'
  | 'connectivity'
  | 'location'
  | 'notifications'
  | 'display'
  | 'security'
  | 'volume'
  | 'permissions'
  | 'root'
  | 'osupgrade'
  | 'vpn';

interface SectionMeta {
  id: SectionId;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}

const SECTIONS: SectionMeta[] = [
  { id: 'general', label: 'General', description: 'Identity, naming and launcher basics', icon: Smartphone },
  { id: 'connectivity', label: 'Connectivity', description: 'WiFi, mobile data, GPS and push transport', icon: Wifi },
  { id: 'location', label: 'Location & Tracking', description: 'Tracking mode and orientation locks', icon: MapPin },
  { id: 'notifications', label: 'Notifications', description: 'Notification bar and delivery', icon: Bell },
  { id: 'display', label: 'Display', description: 'Theme, colors, wallpaper and screen', icon: Monitor },
  { id: 'security', label: 'Security & Controls', description: 'Kiosk, locks and admin access', icon: Lock },
  { id: 'volume', label: 'Volume', description: 'Volume lock and level', icon: Volume2 },
  { id: 'permissions', label: 'App Permissions', description: 'Runtime permission granter', icon: KeyRound },
  { id: 'root', label: 'Root / Compromise', description: 'Compromise detection and response', icon: ShieldAlert },
  { id: 'osupgrade', label: 'OS Upgrade Policy', description: 'System update management', icon: ArrowUpCircle },
  { id: 'vpn', label: 'VPN', description: 'Managed VPN tunnel', icon: Globe },
];

export function ConfigurationManagement() {
  const [activeTab] = useState<TabType>('configuration');
  const [activeSection, setActiveSection] = useState<SectionId>('general');
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState<UpdateDeviceConfigurationRequest>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isBackgroundImageEnabled, setIsBackgroundImageEnabled] = useState(false);
  const queryClient = useQueryClient();

  const hasPermission = usePermissionStore((state) => state.hasPermission);
  const { data: config, isLoading } = useParentConfiguration();
  const updateConfigMutation = useUpdateDeviceConfiguration();

  // Configuration enum data
  const { data: permissionGranters = [] } = useApplicationPermissionGranters();
  const { data: featureStates = [] } = useFeatureStates();
  const { data: locationTrackingTypes = [] } = useLocationTrackingTypes();
  const { data: pushNotificationProtocols = [] } = usePushNotificationProtocols();
  const { data: vpnProtocolTypes = [] } = useVpnProtocolTypes();

  // Initialize form data when config loads
  useEffect(() => {
    if (config) {
      setFormData({
        configName: config.configName,
        description: config.description || '',
        unlockPassword: config.unlockPassword || '',
        locationTrackingByTypeId: config.locationTrackingByTypeId,
        applicationPermissionGranterTypeId: config.applicationPermissionGranterTypeId,
        pushNotificationProtocolTypeId: config.pushNotificationProtocolTypeId,
        wifiStateId: config.wifiStateId,
        gpsStateId: config.gpsStateId,
        notificationBarStateId: config.notificationBarStateId,
        mobileDataStateId: config.mobileDataStateId,
        blockExternalStorage: config.blockExternalStorage,
        manageScreenTimeout: config.manageScreenTimeout,
        screenTimeoutSeconds: config.screenTimeoutSeconds,
        lockVolume: config.lockVolume,
        volumePercentage: config.volumePercentage,
        isDefaultLauncher: config.isDefaultLauncher,
        isInstalledAsDeviceOwner: config.isInstalledAsDeviceOwner,
        useDefaultLauncherTheme: config.useDefaultLauncherTheme,
        backgroundColor: config.backgroundColor,
        applicationNamesColor: config.applicationNamesColor,
        backgroundImageUrl: config.backgroundImageUrl || '',
        iconSize: config.iconSize,
        lockSystemOrientation: config.lockSystemOrientation,
        lockLauncherOrientation: config.lockLauncherOrientation,
        launcherOrientation: config.launcherOrientation,
        hideSystemNotificationBarInLauncher: config.hideSystemNotificationBarInLauncher,
        showLauncherOwnNotificationBar: config.showLauncherOwnNotificationBar,
        enableHomeButton: config.enableHomeButton,
        enableRecentsButton: config.enableRecentsButton,
        enableNotifications: config.enableNotifications,
        enableStatusBarInfo: config.enableStatusBarInfo,
        enableScreenLock: config.enableScreenLock,
        lockPowerButton: config.lockPowerButton,
        enableKioskMode: config.enableKioskMode,
        kioskModePackageId: config.kioskModePackageId,
        screenAlwaysOn: config.screenAlwaysOn,
        newServerURL: config.newServerURL || '',
        deviceAdminCode: config.deviceAdminCode || '',
        isDeviceAdminCodeEnabled: config.isDeviceAdminCodeEnabled,
        allowToAccessSensitiveSettings: config.allowToAccessSensitiveSettings,
        rootDetectionEnabled: config.rootDetectionEnabled ?? true,
        rootDetectionLockOnCompromise: config.rootDetectionLockOnCompromise ?? true,
        rootDetectionWipeOnCompromise: config.rootDetectionWipeOnCompromise ?? false,
        rootDetectionMinSeverityForAction: config.rootDetectionMinSeverityForAction ?? 'CRITICAL',
        rootDetectionScanIntervalMinutes: config.rootDetectionScanIntervalMinutes ?? 15,
        systemUpdatePolicyType: config.systemUpdatePolicyType ?? null,
        maintenanceWindowStart: config.maintenanceWindowStart ?? null,
        maintenanceWindowEnd: config.maintenanceWindowEnd ?? null,
        freezePeriodStart: config.freezePeriodStart ?? null,
        freezePeriodEnd: config.freezePeriodEnd ?? null,
        vpnEnabled: config.vpnEnabled ?? false,
        vpnServerAddress: config.vpnServerAddress ?? '',
        vpnUsername: config.vpnUsername ?? '',
        vpnSecret: config.vpnSecret ?? '',
        vpnProtocolTypeId: config.vpnProtocolTypeId ?? null,
        vpnRoutingRules: config.vpnRoutingRules ?? [],
      });
      setIsBackgroundImageEnabled(!!config.backgroundImageUrl);
    }
  }, [config]);

  const handleSave = async () => {
    if (!config) return;
    try {
      await updateConfigMutation.mutateAsync({
        configId: config.id,
        deviceId: undefined, // deviceId is null for parent config
        ...formData,
      });
      // Refresh the parent configuration data after successful update
      await queryClient.invalidateQueries({ queryKey: ['parentConfiguration'] });
      setIsEditMode(false);
    } catch (err) {
      console.error('Failed to update configuration', err);
    }
  };

  const handleInputChange = (field: keyof UpdateDeviceConfigurationRequest, value: any) => {
    setFormData(prev => {
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

  const handleCancel = () => {
    setIsEditMode(false);
    // Reset form data to original values
    if (config) {
      setFormData({
        configName: config.configName,
        description: config.description || '',
        unlockPassword: config.unlockPassword || '',
        locationTrackingByTypeId: config.locationTrackingByTypeId,
        applicationPermissionGranterTypeId: config.applicationPermissionGranterTypeId,
        pushNotificationProtocolTypeId: config.pushNotificationProtocolTypeId,
        wifiStateId: config.wifiStateId,
        gpsStateId: config.gpsStateId,
        notificationBarStateId: config.notificationBarStateId,
        mobileDataStateId: config.mobileDataStateId,
        blockExternalStorage: config.blockExternalStorage,
        manageScreenTimeout: config.manageScreenTimeout,
        screenTimeoutSeconds: config.screenTimeoutSeconds,
        lockVolume: config.lockVolume,
        volumePercentage: config.volumePercentage,
        isDefaultLauncher: config.isDefaultLauncher,
        isInstalledAsDeviceOwner: config.isInstalledAsDeviceOwner,
        useDefaultLauncherTheme: config.useDefaultLauncherTheme,
        backgroundColor: config.backgroundColor,
        applicationNamesColor: config.applicationNamesColor,
        backgroundImageUrl: config.backgroundImageUrl || '',
        iconSize: config.iconSize,
        lockSystemOrientation: config.lockSystemOrientation,
        lockLauncherOrientation: config.lockLauncherOrientation,
        launcherOrientation: config.launcherOrientation,
        hideSystemNotificationBarInLauncher: config.hideSystemNotificationBarInLauncher,
        showLauncherOwnNotificationBar: config.showLauncherOwnNotificationBar,
        enableHomeButton: config.enableHomeButton,
        enableRecentsButton: config.enableRecentsButton,
        enableNotifications: config.enableNotifications,
        enableStatusBarInfo: config.enableStatusBarInfo,
        enableScreenLock: config.enableScreenLock,
        lockPowerButton: config.lockPowerButton,
        enableKioskMode: config.enableKioskMode,
        kioskModePackageId: config.kioskModePackageId,
        screenAlwaysOn: config.screenAlwaysOn,
        newServerURL: config.newServerURL || '',
        deviceAdminCode: config.deviceAdminCode || '',
        isDeviceAdminCodeEnabled: config.isDeviceAdminCodeEnabled,
        allowToAccessSensitiveSettings: config.allowToAccessSensitiveSettings,
        rootDetectionEnabled: config.rootDetectionEnabled ?? true,
        rootDetectionLockOnCompromise: config.rootDetectionLockOnCompromise ?? true,
        rootDetectionWipeOnCompromise: config.rootDetectionWipeOnCompromise ?? false,
        rootDetectionMinSeverityForAction: config.rootDetectionMinSeverityForAction ?? 'CRITICAL',
        rootDetectionScanIntervalMinutes: config.rootDetectionScanIntervalMinutes ?? 15,
        systemUpdatePolicyType: config.systemUpdatePolicyType ?? null,
        maintenanceWindowStart: config.maintenanceWindowStart ?? null,
        maintenanceWindowEnd: config.maintenanceWindowEnd ?? null,
        freezePeriodStart: config.freezePeriodStart ?? null,
        freezePeriodEnd: config.freezePeriodEnd ?? null,
        vpnEnabled: config.vpnEnabled ?? false,
        vpnServerAddress: config.vpnServerAddress ?? '',
        vpnUsername: config.vpnUsername ?? '',
        vpnSecret: config.vpnSecret ?? '',
        vpnProtocolTypeId: config.vpnProtocolTypeId ?? null,
        vpnRoutingRules: config.vpnRoutingRules ?? [],
      });
      setIsBackgroundImageEnabled(!!config.backgroundImageUrl);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['parentConfiguration'] });
    setIsRefreshing(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!config) return null;

  const canEdit = activeTab === 'configuration' && hasPermission('configuration:update');
  const activeMeta = SECTIONS.find((s) => s.id === activeSection) ?? SECTIONS[0];

  return (
    <div className="flex h-full flex-col">
      {/* ── Sticky header / action bar ───────────────────────────────────── */}
      <div className="sticky top-0 z-10 -mx-1 mb-5 rounded-lg border border-gray-200 bg-white/90 px-5 py-4 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Device Configuration</p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight text-gray-900">{config.configName}</h1>
              {config.isParentConfig && (
                <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                  Parent
                </span>
              )}
              {isEditMode && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Editing — unsaved changes
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-sm text-gray-500">
              {config.description || 'Manage the default parent configuration applied to all devices'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {canEdit && (
              !isEditMode ? (
                <Button size="sm" onClick={() => setIsEditMode(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Configuration
                </Button>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={handleCancel}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={updateConfigMutation.isPending}>
                    <Save className="mr-2 h-4 w-4" />
                    {updateConfigMutation.isPending ? 'Saving…' : 'Save Changes'}
                  </Button>
                </>
              )
            )}
          </div>
        </div>
      </div>

      {/* ── Body: left category rail + active panel ──────────────────────── */}
      <div className="flex min-h-0 flex-1 flex-col gap-5 lg:flex-row lg:gap-6">
        {/* Desktop rail */}
        <nav className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-24 space-y-1">
            {SECTIONS.map((s) => {
              const active = s.id === activeSection;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveSection(s.id)}
                  className={`group flex w-full items-center gap-3 rounded-md border-l-2 px-3 py-2 text-left transition-colors ${
                    active
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <s.icon className={`h-4 w-4 shrink-0 ${active ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                  <span className="truncate text-sm font-medium">{s.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Mobile rail: horizontal chips */}
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden">
          {SECTIONS.map((s) => {
            const active = s.id === activeSection;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSection(s.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600'
                }`}
              >
                <s.icon className="h-3.5 w-3.5" />
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Active panel */}
        <div className="min-w-0 flex-1 lg:overflow-y-auto lg:pb-6">
          <Card className="border border-gray-200 bg-white shadow-sm">
            <CardContent className="p-0">
              {/* Panel header */}
              <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
                <div className="rounded-md bg-blue-50 p-2 text-blue-600">
                  <activeMeta.icon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">{activeMeta.label}</h2>
                  <p className="text-xs text-gray-500">{activeMeta.description}</p>
                </div>
              </div>

              <div className="px-5 py-2">
                {activeSection === 'general' && (
                  <>
                    <ConfigEditItem
                      label="Configuration Name"
                      value={config.configName}
                      editValue={formData.configName || ''}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('configName', v)}
                      type="text"
                    />
                    <ConfigEditItem
                      label="Description"
                      value={config.description || 'No description'}
                      editValue={formData.description || ''}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('description', v)}
                      type="text"
                    />
                    <ConfigItem label="Is Parent Config" value={<BooleanBadge value={config.isParentConfig} />} />
                    <ConfigEditItem
                      label="Icon Size"
                      value={config.iconSize}
                      editValue={formData.iconSize || ''}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('iconSize', v)}
                      type="select"
                      options={[
                        { value: 'small', label: 'Small' },
                        { value: 'medium', label: 'Medium' },
                        { value: 'large', label: 'Large' },
                      ]}
                    />
                  </>
                )}

                {activeSection === 'connectivity' && (
                  <>
                    <ConfigEditItem
                      label="WiFi State"
                      value={<StateBadge value={config.wifiStateName} />}
                      editValue={formData.wifiStateId?.toString() || '0'}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('wifiStateId', parseInt(v))}
                      type="select"
                      options={featureStates.map(state => ({ value: state.id.toString(), label: state.title }))}
                    />
                    <ConfigEditItem
                      label="Mobile Data State"
                      value={<StateBadge value={config.mobileDataStateName} />}
                      editValue={formData.mobileDataStateId?.toString() || '0'}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('mobileDataStateId', parseInt(v))}
                      type="select"
                      options={featureStates.map(state => ({ value: state.id.toString(), label: state.title }))}
                    />
                    <ConfigEditItem
                      label="GPS State"
                      value={<StateBadge value={config.gpsStateName} />}
                      editValue={formData.gpsStateId?.toString() || '0'}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('gpsStateId', parseInt(v))}
                      type="select"
                      options={featureStates.map(state => ({ value: state.id.toString(), label: state.title }))}
                    />
                    <ConfigEditItem
                      label="Push Notification Protocol"
                      value={config.pushNotificationProtocolTypeName}
                      editValue={formData.pushNotificationProtocolTypeId?.toString() || '0'}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('pushNotificationProtocolTypeId', parseInt(v))}
                      type="select"
                      options={pushNotificationProtocols.map(protocol => ({ value: protocol.id.toString(), label: protocol.title }))}
                    />
                  </>
                )}

                {activeSection === 'location' && (
                  <>
                    <ConfigEditItem
                      label="Location Tracking"
                      value={config.locationTrackingByTypeName}
                      editValue={formData.locationTrackingByTypeId?.toString() || '0'}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('locationTrackingByTypeId', parseInt(v))}
                      type="select"
                      options={locationTrackingTypes.map(type => ({ value: type.id.toString(), label: type.title }))}
                    />
                    <ConfigEditItem
                      label="Lock System Orientation"
                      value={<BooleanBadge value={config.lockSystemOrientation} />}
                      editValue={formData.lockSystemOrientation}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('lockSystemOrientation', v)}
                      type="checkbox"
                    />
                    <ConfigEditItem
                      label="Lock Launcher Orientation"
                      value={<BooleanBadge value={config.lockLauncherOrientation} />}
                      editValue={formData.lockLauncherOrientation}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('lockLauncherOrientation', v)}
                      type="checkbox"
                    />
                  </>
                )}

                {activeSection === 'notifications' && (
                  <>
                    <ConfigEditItem
                      label="Notification Bar State"
                      value={<StateBadge value={config.notificationBarStateName} />}
                      editValue={formData.notificationBarStateId?.toString() || '0'}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('notificationBarStateId', parseInt(v))}
                      type="select"
                      options={featureStates.map(state => ({ value: state.id.toString(), label: state.title }))}
                    />
                    <ConfigEditItem
                      label="Enable Notifications"
                      value={<BooleanBadge value={config.enableNotifications} />}
                      editValue={formData.enableNotifications}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('enableNotifications', v)}
                      type="checkbox"
                    />
                    <ConfigEditItem
                      label="Hide System Notification Bar"
                      value={<BooleanBadge value={config.hideSystemNotificationBarInLauncher} />}
                      editValue={formData.hideSystemNotificationBarInLauncher}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('hideSystemNotificationBarInLauncher', v)}
                      type="checkbox"
                    />
                  </>
                )}

                {activeSection === 'display' && (
                  <>
                    <ConfigEditItem
                      label="Use Default Theme"
                      value={<BooleanBadge value={config.useDefaultLauncherTheme} />}
                      editValue={formData.useDefaultLauncherTheme}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('useDefaultLauncherTheme', v)}
                      type="checkbox"
                    />
                    <ConfigEditItem
                      label="Background Color"
                      value={
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded border"
                            style={{ backgroundColor: config.backgroundColor }}
                          />
                          <span>{config.backgroundColor}</span>
                        </div>
                      }
                      editValue={formData.backgroundColor || '#FFFFFF'}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('backgroundColor', v)}
                      type="color"
                    />
                    <ConfigEditItem
                      label="App Names Color"
                      value={
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded border"
                            style={{ backgroundColor: config.applicationNamesColor }}
                          />
                          <span>{config.applicationNamesColor}</span>
                        </div>
                      }
                      editValue={formData.applicationNamesColor || '#000000'}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('applicationNamesColor', v)}
                      type="color"
                    />

                    {/* Background Image URL */}
                    <div className={`py-3 border-b border-gray-100 last:border-0 ${isEditMode ? 'flex justify-between items-center' : 'grid grid-cols-2'}`}>
                      <span className="text-sm font-medium text-gray-600 flex items-center">Background Image</span>
                      {!isEditMode ? (
                        <div className="flex items-center justify-end gap-2">
                           <span className="text-sm font-medium text-gray-900 text-right truncate max-w-[200px]">
                             {config.backgroundImageUrl ? config.backgroundImageUrl : 'Not Set'}
                           </span>
                           {config.backgroundImageUrl && (
                             <Button
                               variant="ghost"
                               size="sm"
                               className="h-6 w-6 p-0"
                               onClick={() => window.open(config.backgroundImageUrl || '', '_blank')}
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
                                    handleInputChange('backgroundImageUrl', '');
                                  }
                                }}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                           </label>

                           {isBackgroundImageEnabled && (
                             <>
                               <input
                                 type="text"
                                 value={formData.backgroundImageUrl || ''}
                                 onChange={(e) => handleInputChange('backgroundImageUrl', e.target.value)}
                                 placeholder="Image URL"
                                 className="h-8 w-48 rounded-md border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                               />
                               {formData.backgroundImageUrl && (
                                 <Button
                                   variant="ghost"
                                   size="sm"
                                   className="h-8 w-8 p-0"
                                   onClick={() => window.open(formData.backgroundImageUrl || '', '_blank')}
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
                      value={<BooleanBadge value={config.screenAlwaysOn} />}
                      editValue={formData.screenAlwaysOn}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('screenAlwaysOn', v)}
                      type="checkbox"
                    />
                    <ConfigEditItem
                      label="Manage Screen Timeout"
                      value={<BooleanBadge value={config.manageScreenTimeout} />}
                      editValue={formData.manageScreenTimeout}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('manageScreenTimeout', v)}
                      type="checkbox"
                    />
                    <ConfigEditItem
                      label="Screen Timeout (seconds)"
                      value={`${config.screenTimeoutSeconds} seconds`}
                      editValue={formData.screenTimeoutSeconds?.toString() || '60'}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('screenTimeoutSeconds', parseInt(v))}
                      type="number"
                    />
                  </>
                )}

                {activeSection === 'security' && (
                  <>
                    <ConfigEditItem
                      label="Enable Kiosk Mode"
                      value={<BooleanBadge value={config.enableKioskMode} />}
                      editValue={formData.enableKioskMode}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('enableKioskMode', v)}
                      type="checkbox"
                    />
                    <ConfigEditItem
                      label="Enable Screen Lock"
                      value={<BooleanBadge value={config.enableScreenLock} />}
                      editValue={formData.enableScreenLock}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('enableScreenLock', v)}
                      type="checkbox"
                    />
                    <ConfigEditItem
                      label="Block External Storage"
                      value={<BooleanBadge value={config.blockExternalStorage} />}
                      editValue={formData.blockExternalStorage}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('blockExternalStorage', v)}
                      type="checkbox"
                    />
                    <ConfigEditItem
                      label="Is Default Launcher"
                      value={<BooleanBadge value={config.isDefaultLauncher} />}
                      editValue={formData.isDefaultLauncher}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('isDefaultLauncher', v)}
                      type="checkbox"
                    />
                    <ConfigEditItem
                      label="Device Admin Code Enabled"
                      value={<BooleanBadge value={config.isDeviceAdminCodeEnabled} />}
                      editValue={formData.isDeviceAdminCodeEnabled}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('isDeviceAdminCodeEnabled', v)}
                      type="checkbox"
                    />
                    <ConfigEditItem
                      label="Device Admin Code"
                      value={config.deviceAdminCode || 'Not set'}
                      editValue={formData.deviceAdminCode || ''}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('deviceAdminCode', v)}
                      type="text"
                    />
                    <ConfigEditItem
                      label="Allow Access to Sensitive Settings"
                      value={<BooleanBadge value={config.allowToAccessSensitiveSettings} />}
                      editValue={formData.allowToAccessSensitiveSettings}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('allowToAccessSensitiveSettings', v)}
                      type="checkbox"
                    />
                  </>
                )}

                {activeSection === 'volume' && (
                  <>
                    <ConfigEditItem
                      label="Lock Volume"
                      value={<BooleanBadge value={config.lockVolume} />}
                      editValue={formData.lockVolume}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('lockVolume', v)}
                      type="checkbox"
                    />
                    <ConfigEditItem
                      label="Volume Level"
                      value={
                        <div className="flex items-center gap-2">
                          <div className="w-32 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${config.volumePercentage}%` }}
                            />
                          </div>
                          <span>{config.volumePercentage}%</span>
                        </div>
                      }
                      editValue={formData.volumePercentage?.toString() || '50'}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('volumePercentage', parseInt(v))}
                      type="range"
                    />
                  </>
                )}

                {activeSection === 'permissions' && (
                  <ConfigEditItem
                    label="Permission Granter"
                    value={config.applicationPermissionGranterTypeName}
                    editValue={formData.applicationPermissionGranterTypeId?.toString() || '0'}
                    isEditMode={isEditMode}
                    onChange={(v) => handleInputChange('applicationPermissionGranterTypeId', parseInt(v))}
                    type="select"
                    options={permissionGranters.map(granter => ({ value: granter.id.toString(), label: granter.title }))}
                  />
                )}

                {activeSection === 'root' && (
                  <>
                    <ConfigEditItem
                      label="Enable Root / Compromise Detection"
                      value={<BooleanBadge value={config.rootDetectionEnabled ?? true} />}
                      editValue={formData.rootDetectionEnabled}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('rootDetectionEnabled', v)}
                      type="checkbox"
                    />
                    <ConfigEditItem
                      label="Lock Device on Compromise"
                      value={<BooleanBadge value={config.rootDetectionLockOnCompromise ?? true} />}
                      editValue={formData.rootDetectionLockOnCompromise}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('rootDetectionLockOnCompromise', v)}
                      type="checkbox"
                    />
                    <ConfigEditItem
                      label="Wipe Device on CRITICAL Compromise"
                      value={<BooleanBadge value={config.rootDetectionWipeOnCompromise ?? false} />}
                      editValue={formData.rootDetectionWipeOnCompromise}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('rootDetectionWipeOnCompromise', v)}
                      type="checkbox"
                    />
                    <ConfigEditItem
                      label="Min Severity for Action"
                      value={config.rootDetectionMinSeverityForAction ?? 'CRITICAL'}
                      editValue={formData.rootDetectionMinSeverityForAction ?? 'CRITICAL'}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('rootDetectionMinSeverityForAction', v)}
                      type="select"
                      options={[
                        { value: 'LOW', label: 'Low' },
                        { value: 'MEDIUM', label: 'Medium' },
                        { value: 'HIGH', label: 'High' },
                        { value: 'CRITICAL', label: 'Critical' },
                      ]}
                    />
                    <ConfigEditItem
                      label="Scan Interval (minutes)"
                      value={config.rootDetectionScanIntervalMinutes ?? 15}
                      editValue={formData.rootDetectionScanIntervalMinutes != null ? formData.rootDetectionScanIntervalMinutes.toString() : ''}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('rootDetectionScanIntervalMinutes', v === '' ? null : parseInt(v))}
                      type="number"
                    />
                  </>
                )}

                {activeSection === 'osupgrade' && (
                  <>
                    <ConfigEditItem
                      label="System Update Policy"
                      value={config.systemUpdatePolicyType || 'Unmanaged (user-controlled)'}
                      editValue={formData.systemUpdatePolicyType ?? ''}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('systemUpdatePolicyType', v === '' ? null : v)}
                      type="select"
                      options={[
                        { value: '', label: 'Unmanaged (user-controlled)' },
                        { value: 'AUTOMATIC', label: 'Automatic' },
                        { value: 'WINDOWED', label: 'Windowed (daily maintenance window)' },
                        { value: 'POSTPONED', label: 'Postponed' },
                        { value: 'FREEZE', label: 'Freeze (auto outside freeze window)' },
                      ]}
                    />
                    <ConfigEditItem
                      label="Maintenance Window Start (minutes from midnight)"
                      value={config.maintenanceWindowStart ?? '—'}
                      editValue={formData.maintenanceWindowStart != null ? formData.maintenanceWindowStart.toString() : ''}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('maintenanceWindowStart', v === '' ? null : parseInt(v))}
                      type="number"
                    />
                    <ConfigEditItem
                      label="Maintenance Window End (minutes from midnight)"
                      value={config.maintenanceWindowEnd ?? '—'}
                      editValue={formData.maintenanceWindowEnd != null ? formData.maintenanceWindowEnd.toString() : ''}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('maintenanceWindowEnd', v === '' ? null : parseInt(v))}
                      type="number"
                    />
                    <ConfigEditItem
                      label="Freeze Period Start"
                      value={config.freezePeriodStart ?? '—'}
                      editValue={formData.freezePeriodStart ?? ''}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('freezePeriodStart', v === '' ? null : v)}
                      type="date"
                    />
                    <ConfigEditItem
                      label="Freeze Period End"
                      value={config.freezePeriodEnd ?? '—'}
                      editValue={formData.freezePeriodEnd ?? ''}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('freezePeriodEnd', v === '' ? null : v)}
                      type="date"
                    />
                  </>
                )}

                {activeSection === 'vpn' && (
                  <>
                    <ConfigEditItem
                      label="Enable VPN"
                      value={<BooleanBadge value={config.vpnEnabled ?? false} />}
                      editValue={formData.vpnEnabled ?? false}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('vpnEnabled', v)}
                      type="checkbox"
                    />
                    <ConfigEditItem
                      label="Protocol"
                      value={config.vpnProtocolTypeName || '—'}
                      editValue={formData.vpnProtocolTypeId != null ? formData.vpnProtocolTypeId.toString() : ''}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('vpnProtocolTypeId', v === '' ? null : parseInt(v))}
                      type="select"
                      options={[
                        { value: '', label: '—' },
                        ...vpnProtocolTypes.map((p) => ({ value: p.id.toString(), label: p.title })),
                      ]}
                    />
                    <ConfigEditItem
                      label="Server Address"
                      value={config.vpnServerAddress || '—'}
                      editValue={formData.vpnServerAddress ?? ''}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('vpnServerAddress', v)}
                      type="text"
                    />
                    <ConfigEditItem
                      label="Username"
                      value={config.vpnUsername || '—'}
                      editValue={formData.vpnUsername ?? ''}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('vpnUsername', v)}
                      type="text"
                    />
                    <ConfigEditItem
                      label="Secret / Key"
                      value={config.vpnSecret ? '••••••••' : '—'}
                      editValue={formData.vpnSecret ?? ''}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('vpnSecret', v)}
                      type="text"
                    />
                    <ConfigEditItem
                      label="Routing Rules (comma-separated CIDRs)"
                      value={config.vpnRoutingRules && config.vpnRoutingRules.length ? config.vpnRoutingRules.join(', ') : 'Full tunnel'}
                      editValue={(formData.vpnRoutingRules ?? []).join(', ')}
                      isEditMode={isEditMode}
                      onChange={(v) => handleInputChange('vpnRoutingRules', v.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0))}
                      type="text"
                    />
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


// Helper Components
function ConfigItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 items-center gap-4 rounded-md px-2 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50/60">
      <span className="text-sm font-medium text-gray-600">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right">{value}</span>
    </div>
  );
}

interface ConfigEditItemProps {
  label: string;
  value: React.ReactNode;
  editValue: string | boolean | undefined;
  isEditMode: boolean;
  onChange: (value: any) => void;
  type: 'text' | 'number' | 'checkbox' | 'select' | 'color' | 'range' | 'date';
  options?: { value: string; label: string }[];
}

function ConfigEditItem({ label, value, editValue, isEditMode, onChange, type, options }: ConfigEditItemProps) {
  if (!isEditMode) {
    return (
      <div className="grid grid-cols-2 items-center gap-4 rounded-md px-2 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50/60">
        <span className="text-sm font-medium text-gray-600">{label}</span>
        <span className="text-sm font-medium text-gray-900 text-right">{value}</span>
      </div>
    );
  }

  return (
    <div className="flex justify-between items-center gap-4 rounded-md px-2 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50/60">
      <span className="text-sm font-medium text-gray-600">{label}</span>
      <div className="flex items-center gap-2">
        {type === 'text' && (
          <input
            type="text"
            value={editValue as string}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 w-48 rounded-md border border-gray-300 bg-white px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        )}
        {type === 'number' && (
          <input
            type="number"
            value={editValue as string}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 w-24 rounded-md border border-gray-300 bg-white px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
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
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        )}
        {type === 'select' && options && (
          <select
            value={editValue as string}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 w-48 rounded-md border border-gray-300 bg-white px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
        {type === 'date' && (
          <input
            type="date"
            value={editValue as string}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 w-48 rounded-md border border-gray-300 bg-white px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        )}
        {type === 'color' && (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={editValue as string}
              onChange={(e) => onChange(e.target.value)}
              className="h-9 w-9 rounded-md border border-gray-300 cursor-pointer"
            />
            <input
              type="text"
              value={editValue as string}
              onChange={(e) => onChange(e.target.value)}
              className="h-9 w-24 rounded-md border border-gray-300 bg-white px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
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
              className="w-32 h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-600"
            />
            <span className="text-sm w-12 text-gray-700">{editValue}%</span>
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
          ? 'bg-green-50 text-green-700 border border-green-200'
          : 'bg-gray-100 text-gray-700'
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
          ? 'bg-blue-50 text-blue-700 border border-blue-200'
          : 'bg-gray-100 text-gray-700'
      }`}
    >
      {value}
    </span>
  );
}
