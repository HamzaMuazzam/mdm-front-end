import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParentConfiguration, useUpdateDeviceConfiguration, useApplicationPermissionGranters, useFeatureStates, useLocationTrackingTypes, usePushNotificationProtocols } from '@/hooks/useDevices';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Wifi, MapPin, Bell, Smartphone, Monitor, Lock, Check, X, Pencil, Save } from 'lucide-react';
import type { UpdateDeviceConfigurationRequest } from '@/types/device.types';

export function ConfigurationManagement() {
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState<UpdateDeviceConfigurationRequest>({});
  const queryClient = useQueryClient();

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
        screenAlwaysOn: config.screenAlwaysOn,
        newServerURL: config.newServerURL || '',
      });
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
    setFormData(prev => ({ ...prev, [field]: value }));
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
        screenAlwaysOn: config.screenAlwaysOn,
        newServerURL: config.newServerURL || '',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Default Configuration</h1>
          <p className="text-muted-foreground mt-1">Manage the default parent configuration for all devices</p>
        </div>
        <div className="flex gap-2">
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
        </div>
      </div>

      {config && (
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              {config.configName}
              {isEditMode && <span className="text-sm font-normal text-muted-foreground">(Editing)</span>}
            </CardTitle>
            {config.description && !isEditMode && (
              <p className="text-sm text-muted-foreground">{config.description}</p>
            )}
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* General Settings */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-lg font-semibold border-b pb-2">
                  <Smartphone className="h-5 w-5 text-blue-500" />
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
                <div className="flex items-center gap-2 text-lg font-semibold border-b pb-2">
                  <Wifi className="h-5 w-5 text-green-500" />
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
                <div className="flex items-center gap-2 text-lg font-semibold border-b pb-2">
                  <MapPin className="h-5 w-5 text-red-500" />
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
                <div className="flex items-center gap-2 text-lg font-semibold border-b pb-2">
                  <Bell className="h-5 w-5 text-yellow-500" />
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
                <ConfigEditItem
                  label="Show Launcher Notification Bar"
                  value={<BooleanBadge value={config.showLauncherOwnNotificationBar} />}
                  editValue={formData.showLauncherOwnNotificationBar}
                  isEditMode={isEditMode}
                  onChange={(v) => handleInputChange('showLauncherOwnNotificationBar', v)}
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
                <div className="flex items-center gap-2 text-lg font-semibold border-b pb-2">
                  <Lock className="h-5 w-5 text-orange-500" />
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
                  label="Lock Power Button"
                  value={<BooleanBadge value={config.lockPowerButton} />}
                  editValue={formData.lockPowerButton}
                  isEditMode={isEditMode}
                  onChange={(v) => handleInputChange('lockPowerButton', v)}
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
                  label="Installed as Device Owner"
                  value={<BooleanBadge value={config.isInstalledAsDeviceOwner} />}
                  editValue={formData.isInstalledAsDeviceOwner}
                  isEditMode={isEditMode}
                  onChange={(v) => handleInputChange('isInstalledAsDeviceOwner', v)}
                  type="checkbox"
                />
              </div>

              {/* Button Controls */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-lg font-semibold border-b pb-2">
                  <Smartphone className="h-5 w-5 text-cyan-500" />
                  Button Controls
                </div>
                <ConfigEditItem
                  label="Enable Home Button"
                  value={<BooleanBadge value={config.enableHomeButton} />}
                  editValue={formData.enableHomeButton}
                  isEditMode={isEditMode}
                  onChange={(v) => handleInputChange('enableHomeButton', v)}
                  type="checkbox"
                />
                <ConfigEditItem
                  label="Enable Recents Button"
                  value={<BooleanBadge value={config.enableRecentsButton} />}
                  editValue={formData.enableRecentsButton}
                  isEditMode={isEditMode}
                  onChange={(v) => handleInputChange('enableRecentsButton', v)}
                  type="checkbox"
                />
                <ConfigEditItem
                  label="Enable Status Bar Info"
                  value={<BooleanBadge value={config.enableStatusBarInfo} />}
                  editValue={formData.enableStatusBarInfo}
                  isEditMode={isEditMode}
                  onChange={(v) => handleInputChange('enableStatusBarInfo', v)}
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
                      <div className="w-32 bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                        <div
                          className="bg-primary h-2 rounded-full"
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
                <div className="flex items-center gap-2 text-lg font-semibold border-b pb-2">
                  <Lock className="h-5 w-5 text-indigo-500" />
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
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Helper Components
function ConfigItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 py-2 border-b border-dashed border-muted last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
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
