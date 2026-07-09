import { useState, useEffect, useRef } from 'react';
import {
  Upload,
  Bell,
  Download,
  RefreshCw,
  CheckCircle,
  XCircle,
  Smartphone,
  Tablet,
  Package,
  FileArchive,
  Hash,
  Clock,
  AlertTriangle,
  Zap,
  FileText,
  Shield,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { appUpdateService } from '@/api/services/app-update.service';
import type { AppUpdate, UpdatePlatform, UpdateType } from '@/types/app-update.types';
import { usePermissionStore } from '@/store/permissionStore';

const PLATFORMS: UpdatePlatform[] = ['ANDROID', 'IOS'];
const UPDATE_TYPES: UpdateType[] = ['NORMAL', 'CRITICAL'];

function formatFileSize(bytes: number): string {
  if (!bytes) return '—';
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDateTime(raw: string): string {
  if (!raw) return '—';
  try {
    return new Date(raw).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return raw; }
}

function TypeBadge({ type }: { type: UpdateType }) {
  return type === 'CRITICAL' ? (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
      <AlertTriangle className="h-3 w-3" />CRITICAL
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
      <Zap className="h-3 w-3" />NORMAL
    </span>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />Inactive
    </span>
  );
}

export function AppUpdateManagement() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasPermission = usePermissionStore((state) => state.hasPermission);
  const canUpload = hasPermission('app-updates:upload');
  const [platform, setPlatform] = useState<UpdatePlatform>('ANDROID');

  // Upload form
  const [versionCode, setVersionCode] = useState('');
  const [updateType, setUpdateType] = useState<UpdateType>('NORMAL');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Notify
  const [notifying, setNotifying] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Latest
  const [latest, setLatest] = useState<AppUpdate | null>(null);
  const [latestLoading, setLatestLoading] = useState(false);

  // History
  const [history, setHistory] = useState<AppUpdate[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [totalElements, setTotalElements] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(10);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  useEffect(() => {
    loadLatest();
    loadHistory(0);
    setPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform]);

  async function loadLatest() {
    setLatestLoading(true);
    try {
      const res = await appUpdateService.getLatestUpdate(platform);
      setLatest(res.success ? res.data : null);
    } catch { setLatest(null); }
    finally { setLatestLoading(false); }
  }

  async function loadHistory(p: number) {
    setHistoryLoading(true);
    try {
      const res = await appUpdateService.getUpdateHistory(platform, p, pageSize);
      if (res.success) {
        setHistory(res.data.content);
        setTotalElements(res.data.totalElements);
      }
    } catch { setHistory([]);  }
    finally { setHistoryLoading(false); }
  }

  async function handleUpload() {
    if (!versionCode || !selectedFile) {
      setUploadMsg({ ok: false, text: 'Version code and file are required.' });
      return;
    }
    setUploading(true);
    setUploadMsg(null);
    try {
      const formData = new FormData();
      formData.append('versionCode', versionCode);
      formData.append('type', updateType);
      formData.append('platform', platform);
      formData.append('releaseNotes', releaseNotes);
      formData.append('file', selectedFile);
      await appUpdateService.uploadUpdate(formData);
      setUploadMsg({ ok: true, text: 'Update uploaded successfully.' });
      setVersionCode(''); setReleaseNotes(''); setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadLatest(); loadHistory(0); setPage(0);
    } catch (err: any) {
      setUploadMsg({ ok: false, text: err?.response?.data?.message || 'Upload failed.' });
    } finally { setUploading(false); }
  }

  async function handleNotify() {
    setNotifying(true); setNotifyMsg(null);
    try {
      await appUpdateService.notifyUsers(platform);
      setNotifyMsg({ ok: true, text: `Notification sent to ${platform} users.` });
    } catch (err: any) {
      setNotifyMsg({ ok: false, text: err?.response?.data?.message || 'Notification failed.' });
    } finally { setNotifying(false); }
  }

  async function handleDownload(item: AppUpdate) {
    setDownloadingId(item.id);
    try {
      const filename = item.downloadUrl.split('/').pop() || `update-${item.versionCode}.apk`;
      await appUpdateService.downloadUpdate(item.downloadUrl, filename);
    } catch { /* silent */ }
    finally { setDownloadingId(null); }
  }

  const totalPages = Math.ceil(totalElements / pageSize);

  return (
    <div className="space-y-6">

      {/* ── Header + Platform Toggle ─────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 rounded-md">
            <Package className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Application Update</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Manage and distribute app versions</p>
          </div>
        </div>

        {/* Platform Pills */}
        <div className="flex gap-2 p-1 bg-gray-100 rounded-lg w-fit">
          {PLATFORMS.map((p) => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                platform === p
                  ? p === 'ANDROID'
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-blue-50 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {p === 'ANDROID' ? <Smartphone className="h-4 w-4" /> : <Tablet className="h-4 w-4" />}
              {p === 'ANDROID' ? 'Android' : 'iOS'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Upload + Latest ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Upload Card */}
        {canUpload && (
          <Card className="border shadow-sm overflow-hidden">
            <CardHeader className="pb-3 border-b border-border bg-muted/30">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
                <div className="p-1.5 bg-blue-50 rounded-md">
                  <Upload className="h-4 w-4 text-blue-600" />
                </div>
                Upload New Update
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Version Code *</Label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      placeholder="e.g. 5"
                      value={versionCode}
                      onChange={(e) => setVersionCode(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Update Type</Label>
                  <select
                    value={updateType}
                    onChange={(e) => setUpdateType(e.target.value as UpdateType)}
                    className="w-full h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                  >
                    {UPDATE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />Release Notes
                </Label>
                <textarea
                  rows={3}
                  value={releaseNotes}
                  onChange={(e) => setReleaseNotes(e.target.value)}
                  placeholder="Describe what's new in this release..."
                  className="w-full rounded-md border border-gray-300 bg-white px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none text-foreground"
                />
              </div>

              {/* File Drop Area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 bg-gray-50 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition-all group"
              >
                <div className="w-12 h-12 bg-gray-100 group-hover:bg-blue-50 rounded-md flex items-center justify-center mx-auto mb-3 transition-colors">
                  <FileArchive className="h-6 w-6 text-muted-foreground group-hover:text-blue-600 transition-colors" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  Click to select {platform === 'ANDROID' ? 'APK' : 'IPA'} file
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {platform === 'ANDROID' ? '.apk files only' : '.ipa files only'}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={platform === 'ANDROID' ? '.apk' : '.ipa'}
                  className="hidden"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
              </div>

              {selectedFile && (
                <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-md px-4 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 bg-blue-50 rounded-md flex items-center justify-center shrink-0">
                      <FileArchive className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    className="ml-3 p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors shrink-0"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>
              )}

              {uploadMsg && (
                <div className={`flex items-center gap-2 rounded-md px-4 py-3 text-sm font-medium ${
                  uploadMsg.ok
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {uploadMsg.ok ? <CheckCircle className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                  {uploadMsg.text}
                </div>
              )}

              <Button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full bg-primary hover:bg-primary-hover text-white shadow-sm"
              >
                {uploading ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Uploading...</>
                ) : (
                  <><Upload className="h-4 w-4 mr-2" />Upload Update</>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Latest Update Card */}
        <Card className={`border shadow-sm overflow-hidden ${!canUpload ? 'lg:col-span-2' : ''}`}>
          {/* Status-stripe header */}
          <div className={`px-5 pt-4 pb-3 border-b border-gray-200 ${
            latest?.isActive
              ? 'bg-green-50'
              : latest
              ? 'bg-gray-50'
              : 'bg-gray-50'
          }`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-md ${
                  platform === 'ANDROID'
                    ? 'bg-blue-50'
                    : 'bg-blue-50'
                }`}>
                  {platform === 'ANDROID' ? <Smartphone className="h-5 w-5 text-blue-600" /> : <Tablet className="h-5 w-5 text-blue-600" />}
                </div>
                <div>
                  <p className="font-semibold text-foreground text-base">Latest Update</p>
                  <p className="text-xs text-muted-foreground">{platform}</p>
                </div>
              </div>
              <button onClick={loadLatest} disabled={latestLoading} className="p-2 rounded-md hover:bg-gray-100 transition-colors">
                <RefreshCw className={`h-4 w-4 text-muted-foreground ${latestLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <CardContent className="p-5">
            {latestLoading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading latest update…</p>
              </div>
            ) : latest ? (
              <div className="space-y-4">
                {/* Version hero */}
                <div className="flex items-center gap-4 p-4 rounded-lg bg-gray-50 border border-gray-200">
                  <div className={`w-14 h-14 rounded-lg ${
                    platform === 'ANDROID' ? 'bg-blue-50' : 'bg-blue-50'
                  } flex items-center justify-center shrink-0`}>
                    <span className="text-blue-700 font-semibold text-xl">v{latest.versionCode}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <TypeBadge type={latest.type} />
                      <StatusBadge isActive={latest.isActive} />
                    </div>
                    <p className="text-xs text-muted-foreground">{formatDateTime(latest.createdAt)}</p>
                  </div>
                </div>

                {/* Detail tiles */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md bg-gray-50 border border-gray-200 p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">File Size</p>
                    <p className="font-semibold text-foreground text-sm">{formatFileSize(latest.fileSize)}</p>
                  </div>
                  <div className="rounded-md bg-gray-50 border border-gray-200 p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Platform</p>
                    <p className="font-semibold text-foreground text-sm">{platform}</p>
                  </div>
                  {latest.releaseNotes && (
                    <div className="col-span-2 rounded-md bg-gray-50 border border-gray-200 p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Release Notes</p>
                      <p className="text-sm text-foreground">{latest.releaseNotes}</p>
                    </div>
                  )}
                  {latest.checksum && (
                    <div className="col-span-2 rounded-md bg-gray-50 border border-gray-200 p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Checksum</p>
                      <p className="text-xs font-mono text-muted-foreground break-all">{latest.checksum}</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <Button
                    onClick={handleNotify}
                    disabled={notifying}
                    className="w-full bg-primary hover:bg-primary-hover text-white shadow-sm"
                  >
                    {notifying ? (
                      <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Sending…</>
                    ) : (
                      <><Bell className="h-4 w-4 mr-2" />Notify {platform === 'ANDROID' ? 'Android' : 'iOS'} Users</>
                    )}
                  </Button>

                  {notifyMsg && (
                    <div className={`flex items-center gap-2 rounded-md px-4 py-3 text-sm font-medium ${
                      notifyMsg.ok
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      {notifyMsg.ok ? <CheckCircle className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                      {notifyMsg.text}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10">
                <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mb-3">
                  {platform === 'ANDROID' ? <Smartphone className="h-8 w-8 text-muted-foreground" /> : <Tablet className="h-8 w-8 text-muted-foreground" />}
                </div>
                <p className="font-medium text-foreground mb-1">No update found</p>
                <p className="text-sm text-muted-foreground">No updates uploaded for {platform} yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Update History ──────────────────────────────────────── */}
      <Card className="border shadow-sm overflow-hidden">
        {/* History header */}
        <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-blue-50 rounded-md">
              <Clock className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-base">Update History</p>
              <p className="text-xs text-muted-foreground">{platform} · {totalElements} release{totalElements !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button
            onClick={() => loadHistory(page)}
            disabled={historyLoading}
            className="p-2 rounded-md hover:bg-gray-100 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 text-muted-foreground ${historyLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <CardContent className="p-0">
          {historyLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading history…</p>
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 px-4">
              <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mb-3">
                <Clock className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground mb-1">No History Found</p>
              <p className="text-sm text-muted-foreground text-center">No update history for {platform} yet.</p>
            </div>
          ) : (
            <>
              {/* ── Mobile: beautiful cards ──────────────────── */}
              <div className="flex flex-col gap-3 p-4 md:hidden">
                {history.map((item) => {
                  const accentClass = item.isActive ? 'border-l-green-500' : 'border-l-gray-200';
                  const avatarGradient = item.type === 'CRITICAL'
                    ? 'bg-red-50 text-red-700'
                    : platform === 'ANDROID'
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-blue-50 text-blue-700';

                  return (
                    <div
                      key={item.id}
                      className={`rounded-lg border border-gray-200 border-l-4 ${accentClass} bg-white shadow-sm overflow-hidden`}
                    >
                      {/* Card header */}
                      <div className="flex items-start gap-3 p-4 pb-3">
                        <div className={`w-12 h-12 rounded-md ${avatarGradient} flex items-center justify-center shrink-0`}>
                          <span className="font-semibold text-sm leading-none">v{item.versionCode}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <TypeBadge type={item.type} />
                            <StatusBadge isActive={item.isActive} />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                            <Clock className="h-3 w-3" />{formatDateTime(item.createdAt)}
                          </p>
                        </div>
                      </div>

                      {/* Release notes */}
                      {item.releaseNotes && (
                        <div className="px-4 pb-3">
                          <p className="text-xs text-muted-foreground italic leading-relaxed">"{item.releaseNotes}"</p>
                        </div>
                      )}

                      {/* Meta grid */}
                      <div className="border-t border-border/60 bg-muted/30 px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                        <div>
                          <span className="text-muted-foreground">File Size</span>
                          <p className="font-medium text-foreground">{formatFileSize(item.fileSize)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Platform</span>
                          <p className="font-medium text-foreground">{platform}</p>
                        </div>
                        {item.checksum && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Checksum</span>
                            <p className="font-mono text-foreground truncate">{item.checksum}</p>
                          </div>
                        )}
                      </div>

                      {/* Action footer */}
                      <div className="px-4 py-2.5 border-t border-border/60 flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownload(item)}
                          disabled={downloadingId === item.id}
                          className="h-8 gap-1.5 text-xs"
                        >
                          {downloadingId === item.id ? (
                            <><RefreshCw className="h-3.5 w-3.5 animate-spin" />Downloading…</>
                          ) : (
                            <><Download className="h-3.5 w-3.5" />Download</>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Desktop table ────────────────────────────── */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Version</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">File Size</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Release Notes</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Created At</th>
                      <th className="text-center px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Download</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {history.map((item) => (
                      <tr key={item.id} className="group hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-9 h-9 rounded-md ${
                              item.type === 'CRITICAL'
                                ? 'bg-red-50 text-red-700'
                                : platform === 'ANDROID'
                                ? 'bg-blue-50 text-blue-700'
                                : 'bg-blue-50 text-blue-700'
                            } flex items-center justify-center shrink-0`}>
                              <span className="font-semibold text-xs">v{item.versionCode}</span>
                            </div>
                            <span className="font-semibold text-foreground">v{item.versionCode}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5"><TypeBadge type={item.type} /></td>
                        <td className="px-5 py-3.5"><StatusBadge isActive={item.isActive} /></td>
                        <td className="px-5 py-3.5 text-muted-foreground text-xs">{formatFileSize(item.fileSize)}</td>
                        <td className="px-5 py-3.5">
                          <span className="text-sm text-muted-foreground max-w-[200px] truncate block" title={item.releaseNotes || ''}>
                            {item.releaseNotes || '—'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(item.createdAt)}</td>
                        <td className="px-5 py-3.5 text-center">
                          <button
                            onClick={() => handleDownload(item)}
                            disabled={downloadingId === item.id}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-blue-50 text-primary transition-colors disabled:opacity-50"
                            title="Download"
                          >
                            {downloadingId === item.id
                              ? <RefreshCw className="h-4 w-4 animate-spin" />
                              : <Download className="h-4 w-4" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-4 border-t border-border bg-muted/20">
                  <p className="text-xs text-muted-foreground">
                    Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalElements)} of {totalElements}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 0}
                      onClick={() => { setPage(page - 1); loadHistory(page - 1); }}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages - 1}
                      onClick={() => { setPage(page + 1); loadHistory(page + 1); }}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
