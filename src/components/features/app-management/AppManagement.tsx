import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Upload,
  Download,
  RefreshCw,
  CheckCircle,
  XCircle,
  Package,
  Smartphone,
  History,
  Search,
  ChevronDown,
  Trash2,
  PlayCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { appManagementService } from '@/api/services/app-management.service';
import { deviceService } from '@/api/services/device.service';
import type { ManagedApp, AppCommand, CommandStatus, CommandType } from '@/types/app-management.types';
import type { Device } from '@/types/device.types';
import { usePermissionStore } from '@/store/permissionStore';
import { parseApkFile } from '@/utils/apkParser';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString();
}

// ─── Badge Components ──────────────────────────────────────────────────────────

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${
        isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
      }`}
    >
      {isActive ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}

function CommandStatusBadge({ status }: { status: CommandStatus }) {
  const styles: Record<CommandStatus, string> = {
    PENDING: 'bg-yellow-100 text-yellow-700',
    SENT: 'bg-blue-100 text-blue-700',
    SUCCESS: 'bg-green-100 text-green-700',
    FAILED: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${styles[status] ?? 'bg-gray-100 text-gray-500'}`}>
      {status}
    </span>
  );
}

function CommandTypeBadge({ type }: { type: CommandType }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${
        type === 'INSTALL_APP' ? 'bg-primary/10 text-primary' : 'bg-orange-100 text-orange-700'
      }`}
    >
      {type === 'INSTALL_APP' ? <PlayCircle className="h-3 w-3" /> : <Trash2 className="h-3 w-3" />}
      {type === 'INSTALL_APP' ? 'Install' : 'Uninstall'}
    </span>
  );
}

// ─── Device Dropdown with Search ──────────────────────────────────────────────

interface DeviceDropdownProps {
  devices: Device[];
  selectedUuid: string;
  onSelect: (uuid: string, name: string) => void;
  placeholder?: string;
}

function DeviceDropdown({ devices, selectedUuid, onSelect, placeholder = 'Select device…' }: DeviceDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return devices.filter(
      (d) =>
        d.deviceName?.toLowerCase().includes(q) ||
        d.deviceUuid?.toLowerCase().includes(q) ||
        d.userEmail?.toLowerCase().includes(q)
    );
  }, [devices, search]);

  const selected = devices.find((d) => d.deviceUuid === selectedUuid);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full h-10 flex items-center justify-between rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary hover:bg-gray-50 transition-colors"
      >
        <span className={selected ? 'text-gray-800' : 'text-gray-400'}>
          {selected ? `${selected.deviceName} (${selected.deviceUuid})` : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search devices…"
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No devices found</p>
            ) : (
              filtered.map((d) => (
                <button
                  key={d.deviceUuid}
                  type="button"
                  onClick={() => {
                    onSelect(d.deviceUuid, d.deviceName);
                    setOpen(false);
                    setSearch('');
                  }}
                  className={`w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors ${
                    d.deviceUuid === selectedUuid ? 'bg-primary/5 font-medium text-primary' : 'text-gray-700'
                  }`}
                >
                  <span className="font-medium">{d.deviceName}</span>
                  <span className="text-xs text-gray-400 ml-2">{d.deviceUuid}</span>
                  {d.userEmail && (
                    <span className="block text-xs text-gray-400">{d.userEmail}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Multi-Device Dropdown with Search, Select All / Deselect All ─────────────

interface MultiDeviceDropdownProps {
  devices: Device[];
  selectedUuids: string[];
  onSelectionChange: (uuids: string[]) => void;
  placeholder?: string;
}

function MultiDeviceDropdown({
  devices,
  selectedUuids,
  onSelectionChange,
  placeholder = 'Select devices…',
}: MultiDeviceDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return devices.filter(
      (d) =>
        d.deviceName?.toLowerCase().includes(q) ||
        d.deviceUuid?.toLowerCase().includes(q) ||
        d.userEmail?.toLowerCase().includes(q)
    );
  }, [devices, search]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function toggleDevice(uuid: string) {
    if (selectedUuids.includes(uuid)) {
      onSelectionChange(selectedUuids.filter((u) => u !== uuid));
    } else {
      onSelectionChange([...selectedUuids, uuid]);
    }
  }

  function selectAll() {
    const filteredUuids = filtered.map((d) => d.deviceUuid);
    const merged = Array.from(new Set([...selectedUuids, ...filteredUuids]));
    onSelectionChange(merged);
  }

  function deselectAll() {
    onSelectionChange([]);
  }

  const selectedCount = selectedUuids.length;
  const buttonLabel =
    selectedCount === 0
      ? placeholder
      : selectedCount === 1
      ? devices.find((d) => d.deviceUuid === selectedUuids[0])?.deviceName ?? '1 device selected'
      : `${selectedCount} devices selected`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full h-10 flex items-center justify-between rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary hover:bg-gray-50 transition-colors"
      >
        <span className={selectedCount > 0 ? 'text-gray-800' : 'text-gray-400'}>{buttonLabel}</span>
        <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg">
          {/* Search */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search devices…"
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          {/* Select All / Deselect All */}
          <div className="flex gap-1 px-2 py-1.5 border-b border-gray-100">
            <button
              type="button"
              onClick={selectAll}
              className="flex-1 text-xs font-semibold text-primary hover:bg-primary/5 py-1 rounded transition-colors"
            >
              Select All
            </button>
            <div className="w-px bg-gray-200" />
            <button
              type="button"
              onClick={deselectAll}
              className="flex-1 text-xs font-semibold text-gray-500 hover:bg-gray-100 py-1 rounded transition-colors"
            >
              Deselect All
            </button>
          </div>
          {/* Device list with checkboxes */}
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No devices found</p>
            ) : (
              filtered.map((d) => {
                const checked = selectedUuids.includes(d.deviceUuid);
                return (
                  <button
                    key={d.deviceUuid}
                    type="button"
                    onClick={() => toggleDevice(d.deviceUuid)}
                    className={`w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors flex items-center gap-2.5 ${
                      checked ? 'bg-primary/5' : ''
                    }`}
                  >
                    <div
                      className={`h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center ${
                        checked ? 'border-primary bg-primary' : 'border-gray-300 bg-white'
                      }`}
                    >
                      {checked && (
                        <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 8" fill="none">
                          <path
                            d="M1 4l3 3 5-6"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className={`font-medium ${checked ? 'text-primary' : 'text-gray-700'}`}>
                        {d.deviceName}
                      </span>
                      <span className="text-xs text-gray-400 ml-2">{d.deviceUuid}</span>
                      {d.userEmail && <span className="block text-xs text-gray-400">{d.userEmail}</span>}
                    </div>
                  </button>
                );
              })
            )}
          </div>
          {/* Footer count */}
          {selectedCount > 0 && (
            <div className="px-3 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-500">
              {selectedCount} device{selectedCount !== 1 ? 's' : ''} selected
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── App Dropdown with Search ─────────────────────────────────────────────────

interface AppDropdownProps {
  apps: ManagedApp[];
  selectedId: number | null;
  onSelect: (app: ManagedApp) => void;
  placeholder?: string;
}

function AppDropdown({ apps, selectedId, onSelect, placeholder = 'Select app…' }: AppDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return apps.filter(
      (a) =>
        a.packageName?.toLowerCase().includes(q) ||
        a.versionName?.toLowerCase().includes(q) ||
        String(a.id).includes(q)
    );
  }, [apps, search]);

  const selected = apps.find((a) => a.id === selectedId);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full h-10 flex items-center justify-between rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary hover:bg-gray-50 transition-colors"
      >
        <span className={selected ? 'text-gray-800' : 'text-gray-400'}>
          {selected
            ? `${selected.packageName}  v${selected.versionName}  (ID: ${selected.id})`
            : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by package or version…"
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No apps found</p>
            ) : (
              filtered.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    onSelect(a);
                    setOpen(false);
                    setSearch('');
                  }}
                  className={`w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${
                    a.id === selectedId ? 'bg-primary/5 font-medium text-primary' : 'text-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium truncate">{a.packageName}</span>
                    <span
                      className={`ml-2 shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold ${
                        a.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {a.isActive ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      {a.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">v{a.versionName}</span>
                    <span className="text-xs text-gray-300">·</span>
                    <span className="text-xs text-gray-400">code: {a.versionCode}</span>
                    <span className="text-xs text-gray-300">·</span>
                    <span className="text-xs text-gray-400">ID: {a.id}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Pagination ────────────────────────────────────────────────────────────────

interface PaginationProps {
  page: number;
  totalPages: number;
  totalElements: number;
  pageSize: number;
  onPageChange: (p: number) => void;
}

function Pagination({ page, totalPages, totalElements, pageSize, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
      <p className="text-sm text-gray-500">
        Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalElements)} of {totalElements}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => onPageChange(page - 1)}>
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages - 1}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

// ─── No Permission Placeholder ─────────────────────────────────────────────────

function NoPermission({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <XCircle className="h-12 w-12 mb-3 text-gray-300" />
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}

// ─── Apps Library Tab ──────────────────────────────────────────────────────────

interface AppsLibraryTabProps {
  canUpload: boolean;
  canRead: boolean;
}

function AppsLibraryTab({ canUpload, canRead }: AppsLibraryTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload form
  const [packageName, setPackageName] = useState('');
  const [versionName, setVersionName] = useState('');
  const [versionCode, setVersionCode] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedFields, setParsedFields] = useState<Set<string>>(new Set());
  const [parsingApk, setParsingApk] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // List
  const [apps, setApps] = useState<ManagedApp[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const PAGE_SIZE = 10;

  // Package filter
  const [packageFilter, setPackageFilter] = useState('');
  const [packageFilterInput, setPackageFilterInput] = useState('');

  // Download
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  useEffect(() => {
    if (canRead) loadApps(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead, packageFilter]);

  async function loadApps(p: number) {
    setLoading(true);
    try {
      const res = packageFilter
        ? await appManagementService.getAppsByPackage(packageFilter, p, PAGE_SIZE)
        : await appManagementService.getAllApps(p, PAGE_SIZE);
      if (res.success) {
        setApps(res.data.content);
        setTotalElements(res.data.totalElements);
        setTotalPages(res.data.totalPages);
        setPage(p);
      }
    } catch {
      setApps([]);
    } finally {
      setLoading(false);
    }
  }

  const handleFileSelect = useCallback(async (file: File | undefined | null) => {
    if (!file) return;
    setSelectedFile(file);
    setParsingApk(true);
    setParsedFields(new Set());
    try {
      const info = await parseApkFile(file);
      const filled = new Set<string>();
      if (info.packageName) { setPackageName(info.packageName); filled.add('packageName'); }
      if (info.versionName) { setVersionName(info.versionName); filled.add('versionName'); }
      if (info.versionCode != null) { setVersionCode(String(info.versionCode)); filled.add('versionCode'); }
      if (info.appName && !description) { setDescription(info.appName); filled.add('description'); }
      setParsedFields(filled);
    } finally {
      setParsingApk(false);
    }
  }, [description]);

  async function handleUpload() {
    if (!packageName.trim() || !versionName.trim() || !versionCode.trim() || !selectedFile) {
      setUploadMsg({ ok: false, text: 'Package name, version name, version code, and APK file are required.' });
      return;
    }
    setUploading(true);
    setUploadMsg(null);
    try {
      const formData = new FormData();
      formData.append('packageName', packageName.trim());
      formData.append('versionName', versionName.trim());
      formData.append('versionCode', versionCode);
      formData.append('description', description.trim());
      formData.append('file', selectedFile);
      const res = await appManagementService.uploadApp(formData);
      if (res.success) {
        setUploadMsg({ ok: true, text: 'App uploaded successfully.' });
        setPackageName('');
        setVersionName('');
        setVersionCode('');
        setDescription('');
        setSelectedFile(null);
        setParsedFields(new Set());
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (canRead) loadApps(0);
      } else {
        setUploadMsg({ ok: false, text: res.message || 'Upload failed.' });
      }
    } catch (err: any) {
      setUploadMsg({ ok: false, text: err?.response?.data?.message || 'Upload failed.' });
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(item: ManagedApp) {
    setDownloadingId(item.id);
    try {
      const filename = item.downloadUrl?.split('/').pop() || `${item.packageName}-${item.versionCode}.apk`;
      await appManagementService.downloadApp(filename);
    } catch {
      // silent
    } finally {
      setDownloadingId(null);
    }
  }

  function applyPackageFilter() {
    setPackageFilter(packageFilterInput.trim());
  }

  function clearFilter() {
    setPackageFilter('');
    setPackageFilterInput('');
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Card */}
        {canUpload && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Upload className="h-5 w-5 text-primary" />
                Upload APK
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* File Drop Area — shown first */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".apk,.xapk"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files?.[0])}
                />
                {!selectedFile ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
                  >
                    <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-600">Click to select APK / XAPK file</p>
                    <p className="text-xs text-gray-400 mt-1">Supports .apk and .xapk — metadata will be auto-filled</p>
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <Package className="h-4 w-4 text-primary shrink-0" />
                      <span className="truncate text-gray-700 font-medium">{selectedFile.name}</span>
                      {parsingApk && (
                        <span className="shrink-0 text-xs text-blue-500 animate-pulse">Reading…</span>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setSelectedFile(null);
                        setParsedFields(new Set());
                        setPackageName('');
                        setVersionName('');
                        setVersionCode('');
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="ml-2 shrink-0 text-gray-400 hover:text-red-500"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Form fields — auto-filled after file selection */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 col-span-2">
                  <Label htmlFor="am-packageName" className="flex items-center gap-1.5">
                    Package Name *
                    {parsedFields.has('packageName') && (
                      <span className="text-xs font-normal text-green-600 bg-green-50 px-1.5 py-0.5 rounded">auto-filled</span>
                    )}
                  </Label>
                  <Input
                    id="am-packageName"
                    placeholder="e.g. com.example.app"
                    value={packageName}
                    onChange={(e) => setPackageName(e.target.value)}
                    className={parsedFields.has('packageName') ? 'border-green-300 bg-green-50/40' : ''}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="am-versionName" className="flex items-center gap-1.5">
                    Version Name *
                    {parsedFields.has('versionName') && (
                      <span className="text-xs font-normal text-green-600 bg-green-50 px-1.5 py-0.5 rounded">auto-filled</span>
                    )}
                  </Label>
                  <Input
                    id="am-versionName"
                    placeholder="e.g. 1.0.0"
                    value={versionName}
                    onChange={(e) => setVersionName(e.target.value)}
                    className={parsedFields.has('versionName') ? 'border-green-300 bg-green-50/40' : ''}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="am-versionCode" className="flex items-center gap-1.5">
                    Version Code *
                    {parsedFields.has('versionCode') && (
                      <span className="text-xs font-normal text-green-600 bg-green-50 px-1.5 py-0.5 rounded">auto-filled</span>
                    )}
                  </Label>
                  <Input
                    id="am-versionCode"
                    type="number"
                    placeholder="e.g. 1"
                    value={versionCode}
                    onChange={(e) => setVersionCode(e.target.value)}
                    className={parsedFields.has('versionCode') ? 'border-green-300 bg-green-50/40' : ''}
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label htmlFor="am-description" className="flex items-center gap-1.5">
                    Description
                    {parsedFields.has('description') && (
                      <span className="text-xs font-normal text-green-600 bg-green-50 px-1.5 py-0.5 rounded">auto-filled</span>
                    )}
                  </Label>
                  <textarea
                    id="am-description"
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional app description…"
                    className={`w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none${parsedFields.has('description') ? ' border-green-300 bg-green-50/40' : ''}`}
                  />
                </div>
              </div>

              {uploadMsg && (
                <p className={`text-sm font-medium ${uploadMsg.ok ? 'text-green-600' : 'text-red-600'}`}>
                  {uploadMsg.text}
                </p>
              )}

              <Button onClick={handleUpload} disabled={uploading} className="w-full">
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? 'Uploading…' : 'Upload App'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Quick Stats Card */}
        {canRead && (
          <Card className={!canUpload ? 'lg:col-span-2' : ''}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="h-5 w-5 text-primary" />
                Library Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-gray-50 text-center">
                  <p className="text-3xl font-bold text-gray-800">{totalElements}</p>
                  <p className="text-xs text-gray-500 mt-1 uppercase font-semibold">Total Apps</p>
                </div>
                <div className="p-4 rounded-lg bg-green-50 text-center">
                  <p className="text-3xl font-bold text-green-700">
                    {apps.filter((a) => a.isActive).length}
                  </p>
                  <p className="text-xs text-gray-500 mt-1 uppercase font-semibold">Active (this page)</p>
                </div>
              </div>
              {!canUpload && (
                <p className="text-xs text-gray-400 mt-4 text-center">
                  Upload permission not allocated to your security group.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Apps Table */}
      {canRead ? (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-lg">Managed Apps</CardTitle>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Filter by package name…"
                  value={packageFilterInput}
                  onChange={(e) => setPackageFilterInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyPackageFilter()}
                  className="w-56 text-sm"
                />
                <Button size="sm" variant="outline" onClick={applyPackageFilter}>
                  <Search className="h-4 w-4" />
                </Button>
                {packageFilter && (
                  <Button size="sm" variant="ghost" onClick={clearFilter}>
                    <XCircle className="h-4 w-4 text-gray-400" />
                  </Button>
                )}
                <button
                  onClick={() => loadApps(page)}
                  disabled={loading}
                  className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                >
                  <RefreshCw className={`h-4 w-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
            {packageFilter && (
              <p className="text-xs text-gray-500 mt-1">
                Filtered by package: <span className="font-mono font-semibold">{packageFilter}</span>
              </p>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-10">
                <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Package</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Version</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Size</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Uploaded By</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Created</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Download</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {apps.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-10 text-gray-400">
                            No apps found.
                          </td>
                        </tr>
                      ) : (
                        apps.map((app) => (
                          <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4">
                              <p className="font-medium text-gray-800">{app.packageName}</p>
                              {app.description && (
                                <p className="text-xs text-gray-400 truncate max-w-[200px]">{app.description}</p>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <p className="font-semibold text-gray-700">{app.versionName}</p>
                              <p className="text-xs text-gray-400">code: {app.versionCode}</p>
                            </td>
                            <td className="px-6 py-4 text-gray-500">{formatFileSize(app.fileSize)}</td>
                            <td className="px-6 py-4"><StatusBadge isActive={app.isActive} /></td>
                            <td className="px-6 py-4 text-gray-500 truncate max-w-[160px]">{app.uploadedByEmail}</td>
                            <td className="px-6 py-4 text-gray-500 whitespace-nowrap">{formatDate(app.createdAt)}</td>
                            <td className="px-6 py-4">
                              <button
                                onClick={() => handleDownload(app)}
                                disabled={downloadingId === app.id}
                                className="p-1.5 rounded-md text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                                title="Download APK"
                              >
                                {downloadingId === app.id ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Download className="h-4 w-4" />
                                )}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  totalElements={totalElements}
                  pageSize={PAGE_SIZE}
                  onPageChange={(p) => loadApps(p)}
                />
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <NoPermission message="You don't have permission to view the app library." />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Deploy Tab ────────────────────────────────────────────────────────────────

interface DeployTabProps {
  devices: Device[];
  devicesLoading: boolean;
  apps: ManagedApp[];
  appsLoading: boolean;
}

function DeployTab({ devices, devicesLoading, apps, appsLoading }: DeployTabProps) {
  // Install form
  const [installDeviceUuids, setInstallDeviceUuids] = useState<string[]>([]);
  const [installApp, setInstallApp] = useState<ManagedApp | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installMsg, setInstallMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [installResults, setInstallResults] = useState<AppCommand[]>([]);

  // Uninstall form
  const [uninstallDeviceUuids, setUninstallDeviceUuids] = useState<string[]>([]);
  const [uninstallPackage, setUninstallPackage] = useState('');
  const [uninstalling, setUninstalling] = useState(false);
  const [uninstallMsg, setUninstallMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [uninstallResults, setUninstallResults] = useState<AppCommand[]>([]);

  async function handleInstall() {
    if (installDeviceUuids.length === 0 || !installApp) {
      setInstallMsg({ ok: false, text: 'Select at least one device and an app.' });
      return;
    }
    setInstalling(true);
    setInstallMsg(null);
    setInstallResults([]);
    try {
      const res = await appManagementService.installApp({
        deviceUuids: installDeviceUuids,
        managedAppId: installApp.id,
      });
      if (res.success) {
        setInstallMsg({
          ok: true,
          text: `Install command sent to ${res.data.length} device${res.data.length !== 1 ? 's' : ''}.`,
        });
        setInstallResults(res.data);
        setInstallDeviceUuids([]);
        setInstallApp(null);
      } else {
        setInstallMsg({ ok: false, text: res.message || 'Install command failed.' });
      }
    } catch (err: any) {
      setInstallMsg({ ok: false, text: err?.response?.data?.message || 'Install command failed.' });
    } finally {
      setInstalling(false);
    }
  }

  async function handleUninstall() {
    if (uninstallDeviceUuids.length === 0 || !uninstallPackage.trim()) {
      setUninstallMsg({ ok: false, text: 'Select at least one device and enter a package name.' });
      return;
    }
    setUninstalling(true);
    setUninstallMsg(null);
    setUninstallResults([]);
    try {
      const res = await appManagementService.uninstallApp({
        deviceUuids: uninstallDeviceUuids,
        packageName: uninstallPackage.trim(),
      });
      if (res.success) {
        setUninstallMsg({
          ok: true,
          text: `Uninstall command sent to ${res.data.length} device${res.data.length !== 1 ? 's' : ''}.`,
        });
        setUninstallResults(res.data);
        setUninstallDeviceUuids([]);
        setUninstallPackage('');
      } else {
        setUninstallMsg({ ok: false, text: res.message || 'Uninstall command failed.' });
      }
    } catch (err: any) {
      setUninstallMsg({ ok: false, text: err?.response?.data?.message || 'Uninstall command failed.' });
    } finally {
      setUninstalling(false);
    }
  }

  function CommandResultList({ results }: { results: AppCommand[] }) {
    if (results.length === 0) return null;
    return (
      <div className="space-y-2">
        {results.map((result) => (
          <div key={result.id} className="rounded-md bg-gray-50 border border-gray-200 p-3 text-xs space-y-1 font-mono">
            <div className="flex justify-between">
              <span className="text-gray-500">Command ID</span>
              <span className="font-semibold">{result.id}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Type</span>
              <CommandTypeBadge type={result.commandType} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Status</span>
              <CommandStatusBadge status={result.status} />
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Device</span>
              <span>{result.deviceName || result.deviceUuid}</span>
            </div>
            {result.packageName && (
              <div className="flex justify-between">
                <span className="text-gray-500">Package</span>
                <span>{result.packageName}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (devicesLoading || appsLoading) {
    return (
      <div className="flex justify-center py-16">
        <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Install / Uninstall forms */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Install */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <PlayCircle className="h-5 w-5 text-primary" />
              Remote Install
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Select Devices *</Label>
              <MultiDeviceDropdown
                devices={devices}
                selectedUuids={installDeviceUuids}
                onSelectionChange={setInstallDeviceUuids}
                placeholder="Select one or more devices…"
              />
            </div>
            <div className="space-y-1">
              <Label>Select App *</Label>
              <AppDropdown
                apps={apps}
                selectedId={installApp?.id ?? null}
                onSelect={(app) => setInstallApp(app)}
                placeholder="Search and select an app…"
              />
            </div>

            {installMsg && (
              <p className={`text-sm font-medium ${installMsg.ok ? 'text-green-600' : 'text-red-600'}`}>
                {installMsg.text}
              </p>
            )}
            {installResults.length > 0 && <CommandResultList results={installResults} />}

            <Button onClick={handleInstall} disabled={installing} className="w-full">
              <PlayCircle className="h-4 w-4 mr-2" />
              {installing ? 'Sending…' : 'Send Install Command'}
            </Button>
          </CardContent>
        </Card>

        {/* Uninstall */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trash2 className="h-5 w-5 text-orange-500" />
              Remote Uninstall
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Select Devices *</Label>
              <MultiDeviceDropdown
                devices={devices}
                selectedUuids={uninstallDeviceUuids}
                onSelectionChange={setUninstallDeviceUuids}
                placeholder="Select one or more devices…"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="uninstall-package">Package Name *</Label>
              <Input
                id="uninstall-package"
                placeholder="e.g. com.example.app"
                value={uninstallPackage}
                onChange={(e) => setUninstallPackage(e.target.value)}
              />
            </div>

            {uninstallMsg && (
              <p className={`text-sm font-medium ${uninstallMsg.ok ? 'text-green-600' : 'text-red-600'}`}>
                {uninstallMsg.text}
              </p>
            )}
            {uninstallResults.length > 0 && <CommandResultList results={uninstallResults} />}

            <Button
              onClick={handleUninstall}
              disabled={uninstalling}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {uninstalling ? 'Sending…' : 'Send Uninstall Command'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Managed Apps List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Package className="h-5 w-5 text-primary" />
            Managed Apps Library
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {apps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <Package className="h-10 w-10 mb-2 text-gray-300" />
              <p className="text-sm">No apps in library yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">ID</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Package</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Version</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Size</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Uploaded By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {apps.map((app) => (
                    <tr
                      key={app.id}
                      onClick={() => setInstallApp(app)}
                      className={`hover:bg-primary/5 transition-colors cursor-pointer ${
                        installApp?.id === app.id ? 'bg-primary/10 ring-1 ring-inset ring-primary/20' : ''
                      }`}
                      title="Click to select for install"
                    >
                      <td className="px-6 py-3 font-mono text-gray-500 text-xs">#{app.id}</td>
                      <td className="px-6 py-3">
                        <p className="font-medium text-gray-800">{app.packageName}</p>
                        {app.description && (
                          <p className="text-xs text-gray-400 truncate max-w-[220px]">{app.description}</p>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        <p className="font-semibold text-gray-700">{app.versionName}</p>
                        <p className="text-xs text-gray-400">code: {app.versionCode}</p>
                      </td>
                      <td className="px-6 py-3 text-gray-500">{formatFileSize(app.fileSize)}</td>
                      <td className="px-6 py-3"><StatusBadge isActive={app.isActive} /></td>
                      <td className="px-6 py-3 text-gray-500 truncate max-w-[160px]">{app.uploadedByEmail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
        {apps.length > 0 && (
          <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 rounded-b-lg">
            <p className="text-xs text-gray-400">
              Click a row to select it for the install form above. Showing {apps.length} app{apps.length !== 1 ? 's' : ''}.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Commands Tab ──────────────────────────────────────────────────────────────

interface CommandsTabProps {
  devices: Device[];
}

function CommandsTab({ devices }: CommandsTabProps) {
  const [commands, setCommands] = useState<AppCommand[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const PAGE_SIZE = 10;

  // Filters
  const [filterType, setFilterType] = useState<'all' | 'device' | 'package'>('all');
  const [filterDeviceUuid, setFilterDeviceUuid] = useState('');
  const [filterPackage, setFilterPackage] = useState('');
  const [filterPackageInput, setFilterPackageInput] = useState('');

  useEffect(() => {
    loadCommands(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, filterDeviceUuid, filterPackage]);

  async function loadCommands(p: number) {
    setLoading(true);
    try {
      let res;
      if (filterType === 'device' && filterDeviceUuid) {
        res = await appManagementService.getCommandsByDevice(filterDeviceUuid, p, PAGE_SIZE);
      } else if (filterType === 'package' && filterPackage) {
        res = await appManagementService.getCommandsByPackage(filterPackage, p, PAGE_SIZE);
      } else {
        res = await appManagementService.getAllCommands(p, PAGE_SIZE);
      }
      if (res.success) {
        setCommands(res.data.content);
        setTotalElements(res.data.totalElements);
        setTotalPages(res.data.totalPages);
        setPage(p);
      }
    } catch {
      setCommands([]);
    } finally {
      setLoading(false);
    }
  }

  function handleFilterTypeChange(type: 'all' | 'device' | 'package') {
    setFilterType(type);
    setFilterDeviceUuid('');
    setFilterPackage('');
    setFilterPackageInput('');
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5 text-primary" />
            Command History
          </CardTitle>
          <div className="flex flex-col gap-2 sm:items-end">
            {/* Filter type selector */}
            <div className="flex gap-1">
              {(['all', 'device', 'package'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => handleFilterTypeChange(t)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                    filterType === t
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {t === 'all' ? 'All' : t === 'device' ? 'By Device' : 'By Package'}
                </button>
              ))}
            </div>

            {/* Device filter */}
            {filterType === 'device' && (
              <div className="w-72">
                <DeviceDropdown
                  devices={devices}
                  selectedUuid={filterDeviceUuid}
                  onSelect={(uuid) => setFilterDeviceUuid(uuid)}
                  placeholder="Select device to filter…"
                />
              </div>
            )}

            {/* Package filter */}
            {filterType === 'package' && (
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Package name…"
                  value={filterPackageInput}
                  onChange={(e) => setFilterPackageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setFilterPackage(filterPackageInput.trim());
                  }}
                  className="w-56 text-sm"
                />
                <Button size="sm" variant="outline" onClick={() => setFilterPackage(filterPackageInput.trim())}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            )}

            <button
              onClick={() => loadCommands(page)}
              disabled={loading}
              className="self-end p-1.5 rounded hover:bg-gray-100 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex justify-center py-10">
            <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">ID</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Device</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Package</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Version</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Initiated By</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Sent At</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {commands.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-10 text-gray-400">
                        No commands found.
                      </td>
                    </tr>
                  ) : (
                    commands.map((cmd) => (
                      <tr key={cmd.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-mono text-gray-500">#{cmd.id}</td>
                        <td className="px-6 py-4"><CommandTypeBadge type={cmd.commandType} /></td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-800">{cmd.deviceName || '—'}</p>
                          <p className="text-xs text-gray-400 font-mono">{cmd.deviceUuid}</p>
                        </td>
                        <td className="px-6 py-4 text-gray-600 font-mono text-xs">{cmd.packageName || '—'}</td>
                        <td className="px-6 py-4 text-gray-500">{cmd.versionName || '—'}</td>
                        <td className="px-6 py-4"><CommandStatusBadge status={cmd.status} /></td>
                        <td className="px-6 py-4 text-gray-500 truncate max-w-[140px]">{cmd.initiatedByEmail || '—'}</td>
                        <td className="px-6 py-4 text-gray-500 whitespace-nowrap">{formatDate(cmd.sentAt)}</td>
                        <td className="px-6 py-4 text-red-500 text-xs max-w-[160px] truncate" title={cmd.errorMessage}>
                          {cmd.errorMessage || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              totalPages={totalPages}
              totalElements={totalElements}
              pageSize={PAGE_SIZE}
              onPageChange={(p) => loadCommands(p)}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

type InnerTab = 'apps' | 'deploy' | 'commands';

export function AppManagement() {
  const hasPermission = usePermissionStore((state) => state.hasPermission);
  const canUpload = hasPermission('app-management:upload');
  const canRead = hasPermission('app-management:read');
  const canDeploy = hasPermission('app-management:deploy');

  const [activeTab, setActiveTab] = useState<InnerTab>(() => {
    if (canRead) return 'apps';
    if (canDeploy) return 'deploy';
    return 'apps';
  });

  const [devices, setDevices] = useState<Device[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);

  const [deployApps, setDeployApps] = useState<ManagedApp[]>([]);
  const [deployAppsLoading, setDeployAppsLoading] = useState(false);

  useEffect(() => {
    if (canDeploy || canRead) {
      loadDevices();
    }
    if (canDeploy) {
      loadDeployApps();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canDeploy, canRead]);

  async function loadDevices() {
    setDevicesLoading(true);
    try {
      const data = await deviceService.getAllDevices();
      setDevices(data);
    } catch {
      setDevices([]);
    } finally {
      setDevicesLoading(false);
    }
  }

  async function loadDeployApps() {
    setDeployAppsLoading(true);
    try {
      const res = await appManagementService.getAllApps(0, 200);
      if (res.success) setDeployApps(res.data.content);
    } catch {
      setDeployApps([]);
    } finally {
      setDeployAppsLoading(false);
    }
  }

  const allTabs: { key: InnerTab; label: string; icon: React.ReactNode; show: boolean }[] = [
    {
      key: 'apps' as InnerTab,
      label: 'Apps Library',
      icon: <Package className="h-4 w-4" />,
      show: canRead || canUpload,
    },
    {
      key: 'deploy' as InnerTab,
      label: 'Deploy',
      icon: <Smartphone className="h-4 w-4" />,
      show: canDeploy,
    },
    {
      key: 'commands' as InnerTab,
      label: 'Command History',
      icon: <History className="h-4 w-4" />,
      show: canRead,
    },
  ];
  const tabs = allTabs.filter((t) => t.show);

  if (!canRead && !canUpload && !canDeploy) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">App Management</h2>
        <Card>
          <CardContent>
            <NoPermission message="You don't have any permissions for App Management." />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-800">App Management</h2>
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                activeTab === tab.key
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'apps' && <AppsLibraryTab canUpload={canUpload} canRead={canRead} />}
      {activeTab === 'deploy' && (
        canDeploy
          ? <DeployTab devices={devices} devicesLoading={devicesLoading} apps={deployApps} appsLoading={deployAppsLoading} />
          : <Card><CardContent><NoPermission message="You don't have permission to deploy apps." /></CardContent></Card>
      )}
      {activeTab === 'commands' && (
        canRead
          ? <CommandsTab devices={devices} />
          : <Card><CardContent><NoPermission message="You don't have permission to view command history." /></CardContent></Card>
      )}
    </div>
  );
}
