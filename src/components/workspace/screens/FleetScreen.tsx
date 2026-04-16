import { useDeferredValue, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppWindow,
  ArrowRight,
  AudioLines,
  BellRing,
  BatteryMedium,
  CircleOff,
  Crosshair,
  Gauge,
  Map,
  MessageSquare,
  Pencil,
  Plus,
  SearchCheck,
  ShieldAlert,
  Smartphone,
  UserCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ModalShell } from '@/components/ui/modal-shell';
import {
  EmptyState,
  FilterPill,
  ScreenIntro,
  SectionCard,
  StatusBadge,
  SurfaceCard,
} from '@/components/workspace/WorkspacePrimitives';
import {
  useCreateDevice,
  useDevicesQuery,
  useToggleDeviceStatus,
  useUpdateDevice,
} from '@/hooks/useDevices';
import {
  useDeviceStatusMqtt,
  useDeviceStatusStore,
} from '@/hooks/useDeviceStatus';
import { mqttService } from '@/api/services/mqtt.service';
import type {
  CreateDeviceRequest,
  Device,
  UpdateDeviceRequest,
} from '@/types/device.types';
import { ROUTES } from '@/utils/constants';

type FleetFilter = 'all' | 'online' | 'offline' | 'attention';

interface FleetScreenProps {
  searchQuery: string;
}

const emptyCreateForm: CreateDeviceRequest = {
  deviceUuid: '',
  phone: '',
  userEmail: '',
  model: '',
  osVersion: '',
  description: '',
};

function buildDeviceRoute(template: string, deviceId: number) {
  return template.replace(':deviceId', String(deviceId));
}

function isAttentionDevice(device: Device) {
  return Boolean(device.deletedAt) || !device.userEmail || (device.batteryCharge ?? 100) < 25;
}

function getDisplayName(device: Device) {
  return device.deviceName || device.model || device.deviceUuid;
}

function getLiveStatus(
  statuses: Record<string, 'online' | 'offline'>,
  device: Device
): 'online' | 'offline' {
  return statuses[device.deviceUuid] ?? 'offline';
}

export function FleetScreen({ searchQuery }: FleetScreenProps) {
  useDeviceStatusMqtt();

  const navigate = useNavigate();
  const deferredSearch = useDeferredValue(searchQuery);
  const deviceStatuses = useDeviceStatusStore((state) => state.statuses);
  const setDeviceStatus = useDeviceStatusStore((state) => state.setStatus);
  const { data: devices = [], isLoading } = useDevicesQuery();
  const createDevice = useCreateDevice();
  const updateDevice = useUpdateDevice();
  const toggleDeviceStatus = useToggleDeviceStatus();

  const [activeFilter, setActiveFilter] = useState<FleetFilter>('all');
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateDeviceRequest>(emptyCreateForm);
  const [editForm, setEditForm] = useState<UpdateDeviceRequest>({
    deviceName: '',
  });

  useEffect(() => {
    if (!devices.length) return;
    let cancelled = false;

    mqttService
      .getClients()
      .then((clients: any[]) => {
        if (cancelled) return;
        const onlineIds = new Set(
          clients
            .filter((client) => client.status?.toLowerCase() === 'online')
            .map((client) => client.deviceId || client.clientId)
            .filter(Boolean)
        );
        devices.forEach((device) => {
          setDeviceStatus(device.deviceUuid, onlineIds.has(device.deviceUuid) ? 'online' : 'offline');
        });
      })
      .catch(() => {
        /* fall back to live MQTT only */
      });

    return () => {
      cancelled = true;
    };
  }, [devices, setDeviceStatus]);

  const normalizedSearch = deferredSearch.trim().toLowerCase();
  const filteredDevices = devices.filter((device) => {
    const matchesSearch = normalizedSearch
      ? [device.deviceName, device.deviceUuid, device.userEmail, device.userName, device.model]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(normalizedSearch))
      : true;

    const liveStatus = getLiveStatus(deviceStatuses, device);

    const matchesFilter =
      activeFilter === 'all' ||
      (activeFilter === 'online' && liveStatus === 'online') ||
      (activeFilter === 'offline' && liveStatus === 'offline') ||
      (activeFilter === 'attention' && isAttentionDevice(device));

    return matchesSearch && matchesFilter;
  });

  useEffect(() => {
    if (!filteredDevices.length) {
      setSelectedDeviceId(null);
      return;
    }

    const stillVisible = filteredDevices.some((device) => device.id === selectedDeviceId);
    if (!stillVisible) {
      setSelectedDeviceId(filteredDevices[0].id);
    }
  }, [filteredDevices, selectedDeviceId]);

  const selectedDevice =
    devices.find((device) => device.id === selectedDeviceId) ?? filteredDevices[0] ?? null;

  const fleetStats = {
    total: devices.length,
    online: devices.filter((device) => getLiveStatus(deviceStatuses, device) === 'online').length,
    attention: devices.filter(isAttentionDevice).length,
  };

  const openDevice = (deviceId: number) => {
    setSelectedDeviceId(deviceId);
    if (window.matchMedia('(max-width: 1023px)').matches) {
      setMobileDetailOpen(true);
    }
  };

  const openEditForDevice = (device: Device) => {
    setSelectedDeviceId(device.id);
    setEditForm({
      deviceName: device.deviceName || device.model || device.deviceUuid,
      description: device.description || '',
      phone: device.phone || '',
      model: device.model || '',
      osVersion: device.osVersion || '',
      batteryCharge: device.batteryCharge ?? 0,
      launcherVariant: device.launcherVariant || '',
      defaultLauncher: device.defaultLauncher || '',
    });
    setEditOpen(true);
  };

  const handleCreateSubmit = async () => {
    if (
      !createForm.deviceUuid.trim() ||
      !createForm.phone.trim() ||
      !createForm.userEmail.trim() ||
      !createForm.model.trim() ||
      !createForm.osVersion.trim()
    ) {
      return;
    }

    await createDevice.mutateAsync(createForm);
    setCreateOpen(false);
    setCreateForm(emptyCreateForm);
  };

  const handleEditSubmit = async () => {
    if (!selectedDevice || !editForm.deviceName?.trim()) return;
    await updateDevice.mutateAsync({
      id: selectedDevice.id,
      deviceName: editForm.deviceName,
      description: editForm.description,
      phone: editForm.phone,
      model: editForm.model,
      osVersion: editForm.osVersion,
      batteryCharge: Number(editForm.batteryCharge ?? 0),
      launcherVariant: editForm.launcherVariant,
      defaultLauncher: editForm.defaultLauncher,
    });
    setEditOpen(false);
  };

  const handleDeviceStatus = async (device: Device) => {
    await toggleDeviceStatus.mutateAsync({
      id: device.id,
      isActive: Boolean(device.deletedAt),
    });
  };

  const detailContent = selectedDevice ? (
    <DeviceDetailPanel
      device={selectedDevice}
      liveStatus={getLiveStatus(deviceStatuses, selectedDevice)}
      onEdit={() => openEditForDevice(selectedDevice)}
      onToggleStatus={() => handleDeviceStatus(selectedDevice)}
      onOpenRoute={(route) => navigate(route)}
    />
  ) : null;

  return (
    <div className="space-y-6">
      <ScreenIntro
        eyebrow="Device operations"
        title="Fleet"
        description="This redesign trades cramped tables for searchable device cards, smart filters, and a progressive detail view that works comfortably on mobile."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Enroll device
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="space-y-4">
          <SectionCard
            title="Fleet stream"
            description="Search first, filter fast, and tap into detail only when needed."
          >
            <div className="grid gap-4">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                <Input
                  value={searchQuery}
                  readOnly
                  className="hidden"
                  aria-hidden="true"
                  tabIndex={-1}
                />
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[1.4rem] border border-border bg-muted/35 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Total devices
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">
                      {fleetStats.total}
                    </p>
                  </div>
                  <div className="rounded-[1.4rem] border border-border bg-muted/35 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Online now
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">
                      {fleetStats.online}
                    </p>
                  </div>
                  <div className="rounded-[1.4rem] border border-border bg-muted/35 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Needs review
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">
                      {fleetStats.attention}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  ['all', 'All devices'],
                  ['online', 'Online'],
                  ['offline', 'Offline'],
                  ['attention', 'Needs attention'],
                ].map(([value, label]) => (
                  <FilterPill
                    key={value}
                    active={activeFilter === value}
                    onClick={() => setActiveFilter(value as FleetFilter)}
                  >
                    {label}
                  </FilterPill>
                ))}
              </div>

              {isLoading ? (
                <div className="grid gap-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="skeleton h-32 rounded-[1.5rem]" />
                  ))}
                </div>
              ) : filteredDevices.length ? (
                <div className="grid gap-3">
                  {filteredDevices.map((device) => {
                    const liveStatus = getLiveStatus(deviceStatuses, device);
                    const active = selectedDeviceId === device.id;

                    return (
                      <button
                        key={device.id}
                        type="button"
                        onClick={() => openDevice(device.id)}
                        className={`w-full rounded-[1.6rem] border p-4 text-left transition ${
                          active
                            ? 'border-transparent bg-slate-950 text-white shadow-[0_28px_70px_rgba(15,23,42,0.28)]'
                            : 'border-border bg-card/85 hover:border-border/80 hover:bg-card'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-heading text-lg font-semibold tracking-tight">
                                {getDisplayName(device)}
                              </p>
                              <StatusBadge tone={liveStatus === 'online' ? 'success' : 'default'}>
                                {liveStatus}
                              </StatusBadge>
                              {device.deletedAt ? (
                                <StatusBadge tone="warning">Paused</StatusBadge>
                              ) : null}
                            </div>
                            <p
                              className={`mt-2 text-sm ${
                                active ? 'text-white/72' : 'text-muted-foreground'
                              }`}
                            >
                              {device.userName || device.userEmail || 'No owner assigned yet'}
                            </p>
                          </div>
                          <ArrowRight
                            className={`h-4 w-4 ${active ? 'text-white/70' : 'text-muted-foreground'}`}
                          />
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <DeviceMeta label="UUID" value={device.deviceUuid} active={active} />
                          <DeviceMeta label="Model" value={device.model || 'Unknown'} active={active} />
                          <DeviceMeta
                            label="Battery"
                            value={`${device.batteryCharge ?? 0}%`}
                            active={active}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  icon={SearchCheck}
                  title="No matching devices"
                  description="Try broadening the search or switching back to a wider filter lane."
                />
              )}
            </div>
          </SectionCard>
        </div>

        <div className="hidden lg:block">{detailContent}</div>
      </div>

      <ModalShell
        open={mobileDetailOpen && Boolean(selectedDevice)}
        onOpenChange={setMobileDetailOpen}
        title={selectedDevice ? getDisplayName(selectedDevice) : 'Device detail'}
        description="Progressive disclosure for device operations on smaller screens."
        className="lg:hidden"
      >
        {detailContent}
      </ModalShell>

      <ModalShell
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Enroll device"
        description="A simplified enrollment form for the new fleet flow."
      >
        <div className="space-y-4">
          <Field label="Device UUID">
            <Input
              value={createForm.deviceUuid}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, deviceUuid: event.target.value }))
              }
              placeholder="6b69d0ff-0c0a-41..."
            />
          </Field>
          <Field label="Owner email">
            <Input
              type="email"
              value={createForm.userEmail}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, userEmail: event.target.value }))
              }
              placeholder="operator@company.com"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone">
              <Input
                value={createForm.phone}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, phone: event.target.value }))
                }
                placeholder="+1 202 555 0142"
              />
            </Field>
            <Field label="Model">
              <Input
                value={createForm.model}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, model: event.target.value }))
                }
                placeholder="Samsung Galaxy XCover"
              />
            </Field>
          </div>
          <Field label="OS version">
            <Input
              value={createForm.osVersion}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, osVersion: event.target.value }))
              }
              placeholder="Android 14"
            />
          </Field>
          <Field label="Operational note">
            <textarea
              value={createForm.description}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, description: event.target.value }))
              }
              className="min-h-[120px] w-full rounded-[1.1rem] border border-input bg-card/90 px-4 py-3 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              placeholder="Optional note about this device’s role or deployment."
            />
          </Field>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSubmit} disabled={createDevice.isPending}>
              {createDevice.isPending ? 'Enrolling...' : 'Enroll device'}
            </Button>
          </div>
        </div>
      </ModalShell>

      <ModalShell
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Refine device record"
        description="Rename and tune the record without leaving the redesigned fleet flow."
      >
        <div className="space-y-4">
          <Field label="Display name">
            <Input
              value={editForm.deviceName || ''}
              onChange={(event) =>
                setEditForm((current) => ({ ...current, deviceName: event.target.value }))
              }
              placeholder="Delivery Unit 104"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone">
              <Input
                value={editForm.phone || ''}
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, phone: event.target.value }))
                }
              />
            </Field>
            <Field label="Model">
              <Input
                value={editForm.model || ''}
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, model: event.target.value }))
                }
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="OS version">
              <Input
                value={editForm.osVersion || ''}
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, osVersion: event.target.value }))
                }
              />
            </Field>
            <Field label="Battery snapshot">
              <Input
                type="number"
                value={String(editForm.batteryCharge ?? 0)}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    batteryCharge: Number(event.target.value),
                  }))
                }
              />
            </Field>
          </div>
          <Field label="Description">
            <textarea
              value={editForm.description || ''}
              onChange={(event) =>
                setEditForm((current) => ({ ...current, description: event.target.value }))
              }
              className="min-h-[120px] w-full rounded-[1.1rem] border border-input bg-card/90 px-4 py-3 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            />
          </Field>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditSubmit} disabled={updateDevice.isPending}>
              {updateDevice.isPending ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
        </div>
      </ModalShell>
    </div>
  );
}

function DeviceMeta({
  label,
  value,
  active,
}: {
  label: string;
  value: string;
  active: boolean;
}) {
  return (
    <div className={`rounded-[1.2rem] border px-3 py-3 ${
      active ? 'border-white/10 bg-white/5' : 'border-border bg-muted/35'
    }`}>
      <p className={`text-[11px] uppercase tracking-[0.18em] ${
        active ? 'text-white/45' : 'text-muted-foreground'
      }`}>
        {label}
      </p>
      <p className={`mt-2 text-sm font-medium ${
        active ? 'text-white' : 'text-foreground'
      }`}>
        {value}
      </p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-foreground">{label}</p>
      {children}
    </div>
  );
}

function DeviceDetailPanel({
  device,
  liveStatus,
  onEdit,
  onToggleStatus,
  onOpenRoute,
}: {
  device: Device;
  liveStatus: 'online' | 'offline';
  onEdit: () => void;
  onToggleStatus: () => void;
  onOpenRoute: (route: string) => void;
}) {
  const shortcuts = [
    {
      icon: Map,
      label: 'Live route',
      route: buildDeviceRoute(ROUTES.DEVICE_TRACKING, device.id),
    },
    {
      icon: AppWindow,
      label: 'App library',
      route: buildDeviceRoute(ROUTES.DEVICE_APPLICATIONS, device.id),
    },
    {
      icon: Gauge,
      label: 'Activity stream',
      route: buildDeviceRoute(ROUTES.DEVICE_MONITOR, device.id),
    },
    {
      icon: BellRing,
      label: 'Messages',
      route: buildDeviceRoute(ROUTES.DEVICE_NOTIFICATIONS, device.id),
    },
    {
      icon: ShieldAlert,
      label: 'Risk alerts',
      route: buildDeviceRoute(ROUTES.DEVICE_ALERT, device.id),
    },
    {
      icon: AudioLines,
      label: 'Audio link',
      route: buildDeviceRoute(ROUTES.DEVICE_AUDIO, device.id),
    },
    {
      icon: Crosshair,
      label: 'Usage lens',
      route: buildDeviceRoute(ROUTES.DEVICE_DATA, device.id),
    },
    {
      icon: MessageSquare,
      label: 'Schedules',
      route: buildDeviceRoute(ROUTES.DEVICE_TIME_RANGE, device.id),
    },
  ];

  return (
    <SurfaceCard>
      <div className="space-y-6 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={liveStatus === 'online' ? 'success' : 'default'}>
                {liveStatus}
              </StatusBadge>
              {device.deletedAt ? <StatusBadge tone="warning">Paused</StatusBadge> : null}
            </div>
            <h3 className="mt-3 font-heading text-2xl font-semibold tracking-tight text-foreground">
              {getDisplayName(device)}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {device.userName || device.userEmail || 'No owner assigned'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <DetailTile
            icon={UserCircle2}
            label="Owner"
            value={device.userEmail || 'Unassigned'}
          />
          <DetailTile icon={BatteryMedium} label="Battery" value={`${device.batteryCharge ?? 0}%`} />
          <DetailTile icon={Smartphone} label="Model" value={device.model || 'Unknown'} />
          <DetailTile icon={CircleOff} label="Phone" value={device.phone || 'Not provided'} />
        </div>

        <div className="rounded-[1.5rem] border border-border bg-muted/35 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Device UUID</p>
          <p className="mt-2 break-all text-sm font-medium text-foreground">{device.deviceUuid}</p>
        </div>

        <SectionCard
          title="Contextual actions"
          description="Jump into deeper device tools without losing the new top-level experience."
          className="border-border bg-muted/20"
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {shortcuts.map((shortcut) => (
              <button
                key={shortcut.label}
                type="button"
                onClick={() => onOpenRoute(shortcut.route)}
                className="flex items-center gap-3 rounded-[1.2rem] border border-border bg-card/70 px-4 py-3 text-left transition hover:border-border/80 hover:bg-card"
              >
                <shortcut.icon className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">{shortcut.label}</span>
              </button>
            ))}
          </div>
        </SectionCard>

        <div className="flex flex-col gap-3">
          <Button variant="outline" onClick={onEdit}>
            Refine record
          </Button>
          <Button
            variant={device.deletedAt ? 'default' : 'destructive'}
            onClick={onToggleStatus}
          >
            {device.deletedAt ? 'Reactivate device' : 'Pause device'}
          </Button>
        </div>
      </div>
    </SurfaceCard>
  );
}

function DetailTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Smartphone;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.4rem] border border-border bg-muted/35 p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <p className="text-xs uppercase tracking-[0.18em]">{label}</p>
      </div>
      <p className="mt-3 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
