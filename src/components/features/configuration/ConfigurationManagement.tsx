import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParentConfiguration, useUpdateDeviceConfiguration, useApplicationPermissionGranters, useFeatureStates, useLocationTrackingTypes, usePushNotificationProtocols } from '@/hooks/useDevices';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Wifi, MapPin, Bell, Smartphone, Monitor, Lock, Check, X, Pencil, Save, RefreshCw, Eye } from 'lucide-react';
import type { UpdateDeviceConfigurationRequest } from '@/types/device.types';
import { usePermissionStore } from '@/store/permissionStore';

type TabType = 'configuration' | 'settings';

export function ConfigurationManagement() {
  const [activeTab, setActiveTab] = useState<TabType>('configuration');
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


  return (
    <div className="flex gap-6 h-full">
      {/* Right Content Area */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {activeTab === 'configuration' ? 'Default Configuration' : 'Settings'}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {activeTab === 'configuration'
                ? 'Manage the default parent configuration for all devices'
                : 'Manage application settings and preferences'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {activeTab === 'configuration' && hasPermission('configuration:update') && (
              <>
                {!isEditMode ? (
                  <Button onClick={() => setIsEditMode(true)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Configuration
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={handleCancel}>
                      Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={updateConfigMutation.isPending}>
                      <Save className="h-4 w-4 mr-2" />
                      {updateConfigMutation.isPending ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        </div>


        <Card className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <CardHeader className="border-b border-gray-200">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <Settings className="h-5 w-5 text-blue-600" />
              {config.configName}
              {isEditMode && <span className="text-sm font-normal text-gray-500">(Editing)</span>}
            </CardTitle>
            {config.description && !isEditMode && (
              <p className="text-sm text-gray-500">{config.description}</p>
            )}
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {/* General Settings */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 border-b border-gray-200 pb-2">
                  <Smartphone className="h-5 w-5 text-blue-600" />
                  General Settings
                </div>
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
              </div>

              {/* Connectivity Settings */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 border-b border-gray-200 pb-2">
                  <Wifi className="h-5 w-5 text-blue-600" />
                  Connectivity
                </div>
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
              </div>

              {/* Location & Tracking */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 border-b border-gray-200 pb-2">
                  <MapPin className="h-5 w-5 text-blue-600" />
                  Location & Tracking
                </div>
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
              </div>

              {/* Notifications */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 border-b border-gray-200 pb-2">
                  <Bell className="h-5 w-5 text-blue-600" />
                  Notifications
                </div>
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
              </div>

              {/* Display Settings */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 border-b border-gray-200 pb-2">
                  <Monitor className="h-5 w-5 text-blue-600" />
                  Display Settings
                </div>
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
                <div className={`py-2 border-b border-dashed border-gray-200 last:border-0 ${isEditMode ? 'flex justify-between items-center' : 'grid grid-cols-2'}`}>
                  <span className="text-sm text-gray-500 flex items-center">Background Image</span>
                  {!isEditMode ? (
                    <div className="flex items-center justify-end gap-2">
                       <span className="text-sm font-medium text-gray-900 text-right truncate max-w-[200px]">
                         {config.backgroundImageUrl ? config.backgroundImageUrl : 'Not Set'}
                       </span>
                       {config.backgroundImageUrl && (
                         <Button
                           variant="ghost"
                           size="icon"
                           className="h-6 w-6"
                           onClick={() => window.open(config.backgroundImageUrl, '_blank')}
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
                               size="icon"
                               className="h-8 w-8"
                               onClick={() => window.open(formData.backgroundImageUrl, '_blank')}
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
              </div>

              {/* Security & Controls */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 border-b border-gray-200 pb-2">
                  <Lock className="h-5 w-5 text-blue-600" />
                  Security & Controls
                </div>
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
              </div>

              {/* Volume Settings */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 border-b border-gray-200 pb-2">
                  <Bell className="h-5 w-5 text-blue-600" />
                  Volume Settings
                </div>
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
              </div>

              {/* Permissions */}
              <div className="space-y-4 md:col-span-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 border-b border-gray-200 pb-2">
                  <Lock className="h-5 w-5 text-blue-600" />
                  Application Permissions
                </div>
                <ConfigEditItem
                  label="Permission Granter"
                  value={config.applicationPermissionGranterTypeName}
                  editValue={formData.applicationPermissionGranterTypeId?.toString() || '0'}
                  isEditMode={isEditMode}
                  onChange={(v) => handleInputChange('applicationPermissionGranterTypeId', parseInt(v))}
                  type="select"
                  options={permissionGranters.map(granter => ({ value: granter.id.toString(), label: granter.title }))}
                />
              </div>

              {/* Root / Compromise Detection Policy */}
              <div className="space-y-4 md:col-span-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 border-b border-gray-200 pb-2">
                  <Lock className="h-5 w-5 text-blue-600" />
                  Root / Compromise Detection
                </div>
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
              </div>

              {/* OS Upgrade (System Update) Policy */}
              <div className="space-y-4 md:col-span-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 border-b border-gray-200 pb-2">
                  <RefreshCw className="h-5 w-5 text-blue-600" />
                  OS Upgrade Policy
                </div>
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
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}


// Helper Components
function ConfigItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 py-2 border-b border-dashed border-gray-200 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
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
      <div className="grid grid-cols-2 py-2 border-b border-dashed border-gray-200 last:border-0">
        <span className="text-sm text-gray-500">{label}</span>
        <span className="text-sm font-medium text-gray-900 text-right">{value}</span>
      </div>
    );
  }

  return (
    <div className="flex justify-between items-center py-2 border-b border-dashed border-gray-200 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <div className="flex items-center gap-2">
        {type === 'text' && (
          <input
            type="text"
            value={editValue as string}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 w-48 rounded-md border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        )}
        {type === 'number' && (
          <input
            type="number"
            value={editValue as string}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 w-24 rounded-md border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
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
            className="h-8 w-48 rounded-md border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
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
            className="h-8 w-48 rounded-md border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        )}
        {type === 'color' && (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={editValue as string}
              onChange={(e) => onChange(e.target.value)}
              className="h-8 w-8 rounded-md border border-gray-300 cursor-pointer"
            />
            <input
              type="text"
              value={editValue as string}
              onChange={(e) => onChange(e.target.value)}
              className="h-8 w-24 rounded-md border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
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
