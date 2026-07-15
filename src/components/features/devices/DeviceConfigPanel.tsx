import { useState, type ComponentType, type ReactNode } from 'react';
import { Wifi, MapPin, Bell, Smartphone, Monitor, Lock, Check, X, Eye, KeyRound, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { UpdateDeviceConfigurationRequest } from '@/types/device.types';

type SectionId = 'general' | 'connectivity' | 'location' | 'notifications' | 'display' | 'security' | 'volume' | 'permissions';

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
];

type EnumItem = { id: number; title: string; name?: string };

interface DeviceConfigPanelProps {
  deviceConfig: any;
  configFormData: UpdateDeviceConfigurationRequest;
  isEditMode: boolean;
  onChange: (field: keyof UpdateDeviceConfigurationRequest, value: any) => void;
  featureStates: EnumItem[];
  locationTrackingTypes: EnumItem[];
  pushNotificationProtocols: EnumItem[];
  permissionGranters: EnumItem[];
  isBackgroundImageEnabled: boolean;
  setIsBackgroundImageEnabled: (v: boolean) => void;
}

export function DeviceConfigPanel({
  deviceConfig,
  configFormData,
  isEditMode,
  onChange,
  featureStates,
  locationTrackingTypes,
  pushNotificationProtocols,
  permissionGranters,
  isBackgroundImageEnabled,
  setIsBackgroundImageEnabled,
}: DeviceConfigPanelProps) {
  const [active, setActive] = useState<SectionId>('general');
  const activeMeta = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0];

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      {/* Desktop rail */}
      <nav className="hidden w-56 shrink-0 overflow-y-auto border-r border-gray-100 p-2 lg:block">
        {SECTIONS.map((s) => {
          const isActive = s.id === active;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(s.id)}
              className={`group mb-0.5 flex w-full items-center gap-2.5 rounded-md border-l-2 px-2.5 py-2 text-left transition-colors ${
                isActive ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <s.icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
              <span className="truncate text-sm font-medium">{s.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Mobile rail: chips */}
      <div className="flex gap-2 overflow-x-auto border-b border-gray-100 p-3 lg:hidden">
        {SECTIONS.map((s) => {
          const isActive = s.id === active;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(s.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
                isActive ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600'
              }`}
            >
              <s.icon className="h-3.5 w-3.5" />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Panel */}
      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-3.5">
          <div className="rounded-md bg-blue-50 p-2 text-blue-600">
            <activeMeta.icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{activeMeta.label}</h3>
            <p className="text-xs text-gray-500">{activeMeta.description}</p>
          </div>
        </div>

        <div className="px-5 py-2">
          {active === 'general' && (
            <>
              <ConfigEditItem label="Configuration Name" value={deviceConfig.configName} editValue={configFormData.configName || ''} isEditMode={isEditMode} onChange={(v) => onChange('configName', v)} type="text" />
              <ConfigEditItem label="Description" value={deviceConfig.description || 'No description'} editValue={configFormData.description || ''} isEditMode={isEditMode} onChange={(v) => onChange('description', v)} type="text" />
              <ConfigItem label="Is Parent Config" value={<BooleanBadge value={deviceConfig.isParentConfig} />} />
              <ConfigEditItem
                label="Icon Size"
                value={deviceConfig.iconSize}
                editValue={configFormData.iconSize || ''}
                isEditMode={isEditMode}
                onChange={(v) => onChange('iconSize', v)}
                type="select"
                options={[
                  { value: 'small', label: 'Small' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'large', label: 'Large' },
                ]}
              />
            </>
          )}

          {active === 'connectivity' && (
            <>
              <ConfigEditItem label="WiFi State" value={<StateBadge value={deviceConfig.wifiStateName} />} editValue={configFormData.wifiStateId?.toString() || '0'} isEditMode={isEditMode} onChange={(v) => onChange('wifiStateId', parseInt(v))} type="select" options={featureStates.map((s) => ({ value: s.id.toString(), label: s.title }))} />
              <ConfigEditItem label="Mobile Data State" value={<StateBadge value={deviceConfig.mobileDataStateName} />} editValue={configFormData.mobileDataStateId?.toString() || '0'} isEditMode={isEditMode} onChange={(v) => onChange('mobileDataStateId', parseInt(v))} type="select" options={featureStates.map((s) => ({ value: s.id.toString(), label: s.title }))} />
              <ConfigEditItem label="Bluetooth State" value={<StateBadge value={deviceConfig.bluetoothStateName} />} editValue={configFormData.bluetoothStateId?.toString() || '0'} isEditMode={isEditMode} onChange={(v) => onChange('bluetoothStateId', parseInt(v))} type="select" options={featureStates.map((s) => ({ value: s.id.toString(), label: s.title }))} />
              <ConfigEditItem label="GPS State" value={<StateBadge value={deviceConfig.gpsStateName} />} editValue={configFormData.gpsStateId?.toString() || '0'} isEditMode={isEditMode} onChange={(v) => onChange('gpsStateId', parseInt(v))} type="select" options={featureStates.map((s) => ({ value: s.id.toString(), label: s.title }))} />
              <ConfigEditItem label="Push Notification Protocol" value={deviceConfig.pushNotificationProtocolTypeName} editValue={configFormData.pushNotificationProtocolTypeId?.toString() || '0'} isEditMode={isEditMode} onChange={(v) => onChange('pushNotificationProtocolTypeId', parseInt(v))} type="select" options={pushNotificationProtocols.map((p) => ({ value: p.id.toString(), label: p.title }))} />
            </>
          )}

          {active === 'location' && (
            <>
              <ConfigEditItem label="Location Tracking" value={deviceConfig.locationTrackingByTypeName} editValue={configFormData.locationTrackingByTypeId?.toString() || '0'} isEditMode={isEditMode} onChange={(v) => onChange('locationTrackingByTypeId', parseInt(v))} type="select" options={locationTrackingTypes.map((t) => ({ value: t.id.toString(), label: t.title }))} />
              <ConfigEditItem label="Lock System Orientation" value={<BooleanBadge value={deviceConfig.lockSystemOrientation} />} editValue={configFormData.lockSystemOrientation} isEditMode={isEditMode} onChange={(v) => onChange('lockSystemOrientation', v)} type="checkbox" />
              <ConfigEditItem label="Lock Launcher Orientation" value={<BooleanBadge value={deviceConfig.lockLauncherOrientation} />} editValue={configFormData.lockLauncherOrientation} isEditMode={isEditMode} onChange={(v) => onChange('lockLauncherOrientation', v)} type="checkbox" />
            </>
          )}

          {active === 'notifications' && (
            <>
              <ConfigEditItem label="Notification Bar State" value={<StateBadge value={deviceConfig.notificationBarStateName} />} editValue={configFormData.notificationBarStateId?.toString() || '0'} isEditMode={isEditMode} onChange={(v) => onChange('notificationBarStateId', parseInt(v))} type="select" options={featureStates.map((s) => ({ value: s.id.toString(), label: s.title }))} />
              <ConfigEditItem label="Enable Notifications" value={<BooleanBadge value={deviceConfig.enableNotifications} />} editValue={configFormData.enableNotifications} isEditMode={isEditMode} onChange={(v) => onChange('enableNotifications', v)} type="checkbox" />
              <ConfigEditItem label="Hide System Notification Bar" value={<BooleanBadge value={deviceConfig.hideSystemNotificationBarInLauncher} />} editValue={configFormData.hideSystemNotificationBarInLauncher} isEditMode={isEditMode} onChange={(v) => onChange('hideSystemNotificationBarInLauncher', v)} type="checkbox" />
              <ConfigEditItem label="Show Launcher Notification Bar" value={<BooleanBadge value={deviceConfig.showLauncherOwnNotificationBar} />} editValue={configFormData.showLauncherOwnNotificationBar} isEditMode={isEditMode} onChange={(v) => onChange('showLauncherOwnNotificationBar', v)} type="checkbox" />
            </>
          )}

          {active === 'display' && (
            <>
              <ConfigEditItem label="Use Default Theme" value={<BooleanBadge value={deviceConfig.useDefaultLauncherTheme} />} editValue={configFormData.useDefaultLauncherTheme} isEditMode={isEditMode} onChange={(v) => onChange('useDefaultLauncherTheme', v)} type="checkbox" />
              <ConfigEditItem
                label="Background Color"
                value={<ColorSwatch value={deviceConfig.backgroundColor} />}
                editValue={configFormData.backgroundColor || '#FFFFFF'}
                isEditMode={isEditMode}
                onChange={(v) => onChange('backgroundColor', v)}
                type="color"
              />
              <ConfigEditItem
                label="App Names Color"
                value={<ColorSwatch value={deviceConfig.applicationNamesColor} />}
                editValue={configFormData.applicationNamesColor || '#000000'}
                isEditMode={isEditMode}
                onChange={(v) => onChange('applicationNamesColor', v)}
                type="color"
              />
              {/* Background Image URL */}
              <div className={`py-3 border-b border-gray-100 last:border-0 ${isEditMode ? 'flex justify-between items-center' : 'grid grid-cols-2'}`}>
                <span className="text-sm font-medium text-gray-600 flex items-center">Background Image</span>
                {!isEditMode ? (
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-sm font-medium text-gray-900 text-right truncate max-w-[200px]">
                      {deviceConfig.backgroundImageUrl ? deviceConfig.backgroundImageUrl : 'Not Set'}
                    </span>
                    {deviceConfig.backgroundImageUrl && (
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => deviceConfig.backgroundImageUrl && window.open(deviceConfig.backgroundImageUrl, '_blank')}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <label className="relative inline-flex items-center cursor-pointer" title={isBackgroundImageEnabled ? 'Disable' : 'Enable'}>
                      <input
                        type="checkbox"
                        checked={isBackgroundImageEnabled}
                        onChange={(e) => {
                          setIsBackgroundImageEnabled(e.target.checked);
                          if (!e.target.checked) onChange('backgroundImageUrl', '');
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                    {isBackgroundImageEnabled && (
                      <>
                        <input
                          type="text"
                          value={configFormData.backgroundImageUrl || ''}
                          onChange={(e) => onChange('backgroundImageUrl', e.target.value)}
                          placeholder="Image URL"
                          className="h-9 w-48 rounded-md border border-gray-300 bg-white px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        {configFormData.backgroundImageUrl && (
                          <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => window.open(configFormData.backgroundImageUrl || '', '_blank')} title="View Image">
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
              <ConfigEditItem label="Screen Always On" value={<BooleanBadge value={deviceConfig.screenAlwaysOn} />} editValue={configFormData.screenAlwaysOn} isEditMode={isEditMode} onChange={(v) => onChange('screenAlwaysOn', v)} type="checkbox" />
              <ConfigEditItem label="Manage Screen Timeout" value={<BooleanBadge value={deviceConfig.manageScreenTimeout} />} editValue={configFormData.manageScreenTimeout} isEditMode={isEditMode} onChange={(v) => onChange('manageScreenTimeout', v)} type="checkbox" />
              <ConfigEditItem label="Screen Timeout (seconds)" value={`${deviceConfig.screenTimeoutSeconds} seconds`} editValue={configFormData.screenTimeoutSeconds?.toString() || '60'} isEditMode={isEditMode} onChange={(v) => onChange('screenTimeoutSeconds', parseInt(v))} type="number" />
            </>
          )}

          {active === 'security' && (
            <>
              <ConfigEditItem
                label="Enable Kiosk Mode"
                value={<BooleanBadge value={deviceConfig.enableKioskMode} />}
                editValue={configFormData.enableKioskMode}
                isEditMode={isEditMode}
                onChange={(v) => {
                  if (v && !configFormData.kioskModePackageId) return;
                  onChange('enableKioskMode', v);
                }}
                type="checkbox"
              />
              {(deviceConfig.enableKioskMode || isEditMode) && (
                <ConfigEditItem
                  label="Kiosk Mode Package ID"
                  value={deviceConfig.kioskModePackageId || 'Not set'}
                  editValue={configFormData.kioskModePackageId || ''}
                  isEditMode={isEditMode}
                  onChange={(v) => {
                    onChange('kioskModePackageId', v);
                    if (!v && configFormData.enableKioskMode) onChange('enableKioskMode', false);
                  }}
                  type="text"
                />
              )}
              {isEditMode && !configFormData.kioskModePackageId && (
                <p className="text-xs text-amber-700 -mt-1 ml-1 pb-1">* Set Package ID first to enable Kiosk Mode</p>
              )}
              <ConfigEditItem
                label="Enable Screen Lock"
                value={<BooleanBadge value={deviceConfig.enableScreenLock} />}
                editValue={configFormData.enableScreenLock}
                isEditMode={isEditMode}
                onChange={(v) => {
                  onChange('enableScreenLock', v);
                  if (!v) onChange('devicePassword', '');
                }}
                type="checkbox"
              />
              {(configFormData.enableScreenLock || (deviceConfig.enableScreenLock && isEditMode)) && (
                <ConfigEditItem label="Device Password" value={deviceConfig.unlockPassword ? '********' : 'Not set'} editValue={configFormData.devicePassword || ''} isEditMode={isEditMode} onChange={(v) => onChange('devicePassword', v)} type="text" />
              )}
              <ConfigEditItem label="Block External Storage" value={<BooleanBadge value={deviceConfig.blockExternalStorage} />} editValue={configFormData.blockExternalStorage} isEditMode={isEditMode} onChange={(v) => onChange('blockExternalStorage', v)} type="checkbox" />
              <ConfigEditItem label="Is Default Launcher" value={<BooleanBadge value={deviceConfig.isDefaultLauncher} />} editValue={configFormData.isDefaultLauncher} isEditMode={isEditMode} onChange={(v) => onChange('isDefaultLauncher', v)} type="checkbox" />
              <ConfigEditItem label="Device Admin Code Enabled" value={<BooleanBadge value={deviceConfig.isDeviceAdminCodeEnabled} />} editValue={configFormData.isDeviceAdminCodeEnabled} isEditMode={isEditMode} onChange={(v) => onChange('isDeviceAdminCodeEnabled', v)} type="checkbox" />
              <ConfigEditItem label="Device Admin Code" value={deviceConfig.deviceAdminCode || 'Not set'} editValue={configFormData.deviceAdminCode || ''} isEditMode={isEditMode} onChange={(v) => onChange('deviceAdminCode', v)} type="text" />
              <ConfigEditItem label="Allow Access to Sensitive Settings" value={<BooleanBadge value={deviceConfig.allowToAccessSensitiveSettings} />} editValue={configFormData.allowToAccessSensitiveSettings} isEditMode={isEditMode} onChange={(v) => onChange('allowToAccessSensitiveSettings', v)} type="checkbox" />
              <ConfigEditItem label="Block Airplane Mode (strict)" value={<BooleanBadge value={deviceConfig.strictAirplaneMode ?? true} />} editValue={configFormData.strictAirplaneMode ?? true} isEditMode={isEditMode} onChange={(v) => onChange('strictAirplaneMode', v)} type="checkbox" />
              <ConfigEditItem label="Factory Reset Lock" value={<BooleanBadge value={deviceConfig.factoryResetLock ?? true} />} editValue={configFormData.factoryResetLock ?? true} isEditMode={isEditMode} onChange={(v) => onChange('factoryResetLock', v)} type="checkbox" />
              <ConfigEditItem label="Network Reset Lock (Wi-Fi, mobile & Bluetooth)" value={<BooleanBadge value={deviceConfig.networkResetLock ?? true} />} editValue={configFormData.networkResetLock ?? true} isEditMode={isEditMode} onChange={(v) => onChange('networkResetLock', v)} type="checkbox" />
              <ConfigEditItem label="Block App Tampering (apps control)" value={<BooleanBadge value={deviceConfig.appsControlLock ?? false} />} editValue={configFormData.appsControlLock ?? false} isEditMode={isEditMode} onChange={(v) => onChange('appsControlLock', v)} type="checkbox" />
            </>
          )}

          {active === 'volume' && (
            <>
              <ConfigEditItem label="Lock Volume" value={<BooleanBadge value={deviceConfig.lockVolume} />} editValue={configFormData.lockVolume} isEditMode={isEditMode} onChange={(v) => onChange('lockVolume', v)} type="checkbox" />
              <ConfigEditItem
                label="Volume Level"
                value={
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${deviceConfig.volumePercentage}%` }} />
                    </div>
                    <span>{deviceConfig.volumePercentage}%</span>
                  </div>
                }
                editValue={configFormData.volumePercentage?.toString() || '50'}
                isEditMode={isEditMode}
                onChange={(v) => onChange('volumePercentage', parseInt(v))}
                type="range"
              />
            </>
          )}

          {active === 'permissions' && (
            <ConfigEditItem label="Permission Granter" value={deviceConfig.applicationPermissionGranterTypeName} editValue={configFormData.applicationPermissionGranterTypeId?.toString() || '0'} isEditMode={isEditMode} onChange={(v) => onChange('applicationPermissionGranterTypeId', parseInt(v))} type="select" options={permissionGranters.map((g) => ({ value: g.id.toString(), label: g.title }))} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shared row/badge primitives (kept local to this panel) ──────────────────

function ColorSwatch({ value }: { value: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-6 h-6 rounded border" style={{ backgroundColor: value }} />
      <span>{value}</span>
    </div>
  );
}

function ConfigItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-2 items-center gap-4 rounded-md px-2 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50/60">
      <span className="text-sm font-medium text-gray-600">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right">{value}</span>
    </div>
  );
}

interface ConfigEditItemProps {
  label: string;
  value: ReactNode;
  editValue: string | boolean | undefined;
  isEditMode: boolean;
  onChange: (value: any) => void;
  type: 'text' | 'number' | 'checkbox' | 'select' | 'color' | 'range';
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
          <input type="text" value={editValue as string} onChange={(e) => onChange(e.target.value)} className="h-9 w-48 rounded-md border border-gray-300 bg-white px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        )}
        {type === 'number' && (
          <input type="number" value={editValue as string} onChange={(e) => onChange(e.target.value)} className="h-9 w-24 rounded-md border border-gray-300 bg-white px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        )}
        {type === 'checkbox' && (
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={editValue as boolean} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        )}
        {type === 'select' && options && (
          <select value={editValue as string} onChange={(e) => onChange(e.target.value)} className="h-9 w-48 rounded-md border border-gray-300 bg-white px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
        {type === 'color' && (
          <div className="flex items-center gap-2">
            <input type="color" value={editValue as string} onChange={(e) => onChange(e.target.value)} className="h-9 w-9 rounded-md border border-gray-300 cursor-pointer" />
            <input type="text" value={editValue as string} onChange={(e) => onChange(e.target.value)} className="h-9 w-24 rounded-md border border-gray-300 bg-white px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
        )}
        {type === 'range' && (
          <div className="flex items-center gap-2">
            <input type="range" min="0" max="100" value={editValue as string} onChange={(e) => onChange(e.target.value)} className="w-32 h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-600" />
            <span className="text-sm w-12 text-gray-700">{editValue}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

function BooleanBadge({ value }: { value: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${value ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-700'}`}>
      {value ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {value ? 'Enabled' : 'Disabled'}
    </span>
  );
}

function StateBadge({ value }: { value: string }) {
  const isAny = (value || '').toUpperCase() === 'ANY';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${isAny ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-700'}`}>
      {value}
    </span>
  );
}
