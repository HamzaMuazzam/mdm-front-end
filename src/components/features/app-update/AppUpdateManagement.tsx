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

function TypeBadge({ type }: { type: UpdateType }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
        type === 'CRITICAL'
          ? 'bg-red-100 text-red-700'
          : 'bg-green-100 text-green-700'
      }`}
    >
      {type}
    </span>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${
        isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
      }`}
    >
      {isActive ? (
        <CheckCircle className="h-3 w-3" />
      ) : (
        <XCircle className="h-3 w-3" />
      )}
      {isActive ? 'Active' : 'Inactive'}
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
    } catch {
      setLatest(null);
    } finally {
      setLatestLoading(false);
    }
  }

  async function loadHistory(p: number) {
    setHistoryLoading(true);
    try {
      const res = await appUpdateService.getUpdateHistory(platform, p, pageSize);
      if (res.success) {
        setHistory(res.data.content);
        setTotalElements(res.data.totalElements);
      }
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
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
      setVersionCode('');
      setReleaseNotes('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadLatest();
      loadHistory(0);
      setPage(0);
    } catch (err: any) {
      setUploadMsg({ ok: false, text: err?.response?.data?.message || 'Upload failed.' });
    } finally {
      setUploading(false);
    }
  }

  async function handleNotify() {
    setNotifying(true);
    setNotifyMsg(null);
    try {
      await appUpdateService.notifyUsers(platform);
      setNotifyMsg({ ok: true, text: `Notification sent to ${platform} users.` });
    } catch (err: any) {
      setNotifyMsg({ ok: false, text: err?.response?.data?.message || 'Notification failed.' });
    } finally {
      setNotifying(false);
    }
  }

  async function handleDownload(item: AppUpdate) {
    setDownloadingId(item.id);
    try {
      const filename = item.downloadUrl.split('/').pop() || `update-${item.versionCode}.apk`;
      await appUpdateService.downloadUpdate(item.downloadUrl, filename);
    } catch {
      // silent
    } finally {
      setDownloadingId(null);
    }
  }

  const totalPages = Math.ceil(totalElements / pageSize);

  return (
    <div className="space-y-6">
      {/* Header + Platform Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Application Update</h2>
        <div className="flex gap-2">
          {PLATFORMS.map((p) => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                platform === p
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p === 'ANDROID' ? <Smartphone className="h-4 w-4" /> : <Tablet className="h-4 w-4" />}
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Card — visible only with app-updates:upload permission */}
        {canUpload && <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Upload className="h-5 w-5 text-primary" />
              Upload New Update
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="versionCode">Version Code *</Label>
                <Input
                  id="versionCode"
                  type="number"
                  placeholder="e.g. 5"
                  value={versionCode}
                  onChange={(e) => setVersionCode(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="updateType">Update Type</Label>
                <select
                  id="updateType"
                  value={updateType}
                  onChange={(e) => setUpdateType(e.target.value as UpdateType)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {UPDATE_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="releaseNotes">Release Notes</Label>
              <textarea
                id="releaseNotes"
                rows={3}
                value={releaseNotes}
                onChange={(e) => setReleaseNotes(e.target.value)}
                placeholder="Describe what's new in this release..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>

            {/* File Drop Area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                Click to select {platform === 'ANDROID' ? 'APK' : 'IPA'} file
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
              <div className="flex items-center justify-between bg-gray-50 rounded-md px-3 py-2 text-sm">
                <span className="truncate text-gray-700">{selectedFile.name}</span>
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="ml-2 text-gray-400 hover:text-red-500"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
            )}

            {uploadMsg && (
              <p className={`text-sm font-medium ${uploadMsg.ok ? 'text-green-600' : 'text-red-600'}`}>
                {uploadMsg.text}
              </p>
            )}

            <Button onClick={handleUpload} disabled={uploading} className="w-full">
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? 'Uploading...' : 'Upload Update'}
            </Button>
          </CardContent>
        </Card>}

        {/* Latest Update Card */}
        <Card className={!canUpload ? 'lg:col-span-2' : ''}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Latest Update</CardTitle>
              <button
                onClick={loadLatest}
                disabled={latestLoading}
                className="p-1 rounded hover:bg-gray-100 transition-colors"
              >
                <RefreshCw className={`h-4 w-4 text-gray-500 ${latestLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {latestLoading ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : latest ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold">Version Code</p>
                    <p className="text-lg font-bold text-gray-800">{latest.versionCode}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold">Type</p>
                    <div className="mt-1"><TypeBadge type={latest.type} /></div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold">Status</p>
                    <div className="mt-1"><StatusBadge isActive={latest.isActive} /></div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold">File Size</p>
                    <p className="text-sm font-medium text-gray-700">{formatFileSize(latest.fileSize)}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500 uppercase font-semibold">Release Notes</p>
                    <p className="text-sm text-gray-700 mt-0.5">{latest.releaseNotes || '—'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500 uppercase font-semibold">Created At</p>
                    <p className="text-sm text-gray-700 mt-0.5">{latest.createdAt}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500 uppercase font-semibold">Checksum</p>
                    <p className="text-xs font-mono break-all text-gray-600 mt-0.5">{latest.checksum}</p>
                  </div>
                </div>

                <hr className="border-gray-100" />

                <Button onClick={handleNotify} disabled={notifying} className="w-full bg-green-600 hover:bg-green-700 text-white">
                  <Bell className="h-4 w-4 mr-2" />
                  {notifying ? 'Sending...' : `Notify ${platform} Users`}
                </Button>

                {notifyMsg && (
                  <p className={`text-sm font-medium ${notifyMsg.ok ? 'text-green-600' : 'text-red-600'}`}>
                    {notifyMsg.text}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <Smartphone className="h-10 w-10 mb-2" />
                <p className="text-sm">No update found for {platform}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* History Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Update History — {platform}</CardTitle>
            <button
              onClick={() => loadHistory(page)}
              disabled={historyLoading}
              className="p-1 rounded hover:bg-gray-100 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 text-gray-500 ${historyLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {historyLoading ? (
            <div className="flex justify-center py-10">
              <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Version</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">File Size</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Release Notes</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Created At</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Download</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {history.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-10 text-gray-400">
                          No update history found.
                        </td>
                      </tr>
                    ) : (
                      history.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 font-bold text-gray-800">v{item.versionCode}</td>
                          <td className="px-6 py-4"><TypeBadge type={item.type} /></td>
                          <td className="px-6 py-4"><StatusBadge isActive={item.isActive} /></td>
                          <td className="px-6 py-4 text-gray-500">{formatFileSize(item.fileSize)}</td>
                          <td className="px-6 py-4 text-gray-600 max-w-[200px] truncate">{item.releaseNotes || '—'}</td>
                          <td className="px-6 py-4 text-gray-500 whitespace-nowrap">{item.createdAt}</td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => handleDownload(item)}
                              disabled={downloadingId === item.id}
                              className="p-1.5 rounded-md text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                              title="Download"
                            >
                              {downloadingId === item.id ? (
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

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
                  <p className="text-sm text-gray-500">
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
