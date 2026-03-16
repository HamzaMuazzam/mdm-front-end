import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Folder,
  FileText,
  Trash2,
  Download,
  Upload,
  MoveRight,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  HardDrive,
  Activity,
  ChevronRight,
  ArrowLeft,
  Home,
  X,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useSendFileCommand, usePollCommand, useFileEventsByDevice, usePollTransfer } from '@/hooks/useFileManager';
import { fileManagerService } from '@/api/services/file-manager.service';
import { toast } from '@/hooks/useToast';
import type {
  FileNode,
  FileCommandResponse,
  DeviceFileResponse,
  FileCommandType,
  SendFileCommandRequest,
} from '@/types/file-manager.types';

// ── Props ─────────────────────────────────────────────────────────────────────

interface FileManagerExplorerProps {
  deviceUuid: string;
  deviceName?: string | null;
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: FileCommandResponse['status'] | null }) {
  if (!status) return null;
  const map = {
    PENDING:   { color: 'text-yellow-400', icon: <Clock className="h-3 w-3" />,                            label: 'Pending' },
    SENT:      { color: 'text-blue-400',   icon: <RefreshCw className="h-3 w-3 animate-spin" />,           label: 'Waiting…' },
    COMPLETED: { color: 'text-green-400',  icon: <CheckCircle className="h-3 w-3" />,                      label: 'Done' },
    FAILED:    { color: 'text-red-400',    icon: <AlertCircle className="h-3 w-3" />,                      label: 'Failed' },
  } as const;
  const s = map[status];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${s.color}`}>
      {s.icon}{s.label}
    </span>
  );
}

// ── File row ──────────────────────────────────────────────────────────────────

interface FileRowProps {
  node: FileNode;
  isSelected: boolean;
  onSelect: () => void;
  onEnter: () => void;
}

function FileRow({ node, isSelected, onSelect, onEnter }: FileRowProps) {
  return (
    <div
      onClick={() => { onSelect(); if (node.isDirectory) onEnter(); }}
      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer select-none transition-colors group ${
        isSelected
          ? 'bg-blue-500/15 text-blue-200'
          : 'hover:bg-white/5 text-gray-300'
      }`}
    >
      {node.isDirectory ? (
        <Folder className={`h-4 w-4 shrink-0 transition-colors ${isSelected ? 'text-yellow-300' : 'text-yellow-400 group-hover:text-yellow-300'}`} />
      ) : (
        <FileText className={`h-4 w-4 shrink-0 ${isSelected ? 'text-blue-300' : 'text-gray-500'}`} />
      )}

      <span className="flex-1 text-sm truncate font-medium">
        {node.name}
      </span>

      {!node.isDirectory && (
        <>
          <span className="text-xs text-gray-600 shrink-0 uppercase">
            {node.extension || '—'}
          </span>
          <span className="text-xs text-gray-500 shrink-0 w-16 text-right">
            {formatSize(node.size)}
          </span>
        </>
      )}

      <span className="text-xs text-gray-600 shrink-0 w-24 text-right hidden sm:block">
        {new Date(node.lastModified).toLocaleDateString()}
      </span>

      {node.isDirectory && (
        <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-colors ${isSelected ? 'text-blue-400' : 'text-gray-600'}`} />
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function FileManagerExplorer({ deviceUuid, deviceName }: FileManagerExplorerProps) {
  const [fileItems, setFileItems]             = useState<FileNode[]>([]);
  const [currentPath, setCurrentPath]         = useState('');
  const [pathHistory, setPathHistory]         = useState<string[]>([]);
  const [selectedNode, setSelectedNode]       = useState<FileNode | null>(null);
  const [hasLoaded, setHasLoaded]             = useState(false);
  const [pendingCommandId, setPendingCommandId]       = useState<number | null>(null);
  const [pendingCommandType, setPendingCommandType]   = useState<FileCommandType | null>(null);
  const [moveDest, setMoveDest]               = useState('');
  const [showMoveInput, setShowMoveInput]     = useState(false);
  const [uploadFile, setUploadFile]           = useState<File | null>(null);
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [activeSection, setActiveSection]     = useState<'explorer' | 'events'>('explorer');
  const [activeTransferId, setActiveTransferId]         = useState<string | null>(null);
  const [activeTransferType, setActiveTransferType]     = useState<'DOWNLOAD' | 'VIEW' | 'UPLOAD' | null>(null);

  // Refs to avoid stale closures in effects
  const selectedNodeRef = useRef<FileNode | null>(null);
  useEffect(() => { selectedNodeRef.current = selectedNode; }, [selectedNode]);

  const sendCommand = useSendFileCommand(deviceUuid);
  const { data: polledCommand } = usePollCommand(pendingCommandId, pendingCommandId !== null);
  const { data: polledTransfer } = usePollTransfer(activeTransferId, activeTransferId !== null);
  const { data: events } = useFileEventsByDevice(deviceUuid);
  const transferData = polledTransfer?.data;

  const commandData: FileCommandResponse | undefined = polledCommand?.data;

  // ── Dispatch helper ───────────────────────────────────────────────────────

  const dispatchCommand = useCallback(async (
    commandType: FileCommandType,
    extra: Partial<Omit<SendFileCommandRequest, 'deviceUuid' | 'commandType'>> = {}
  ) => {
    try {
      const res = await sendCommand.mutateAsync({ deviceUuid, commandType, ...extra } as SendFileCommandRequest);
      const cmd = res.data;
      if (cmd && cmd.status !== 'FAILED') {
        setPendingCommandId(cmd.id);
        setPendingCommandType(commandType);
      }
    } catch {
      // error toast is handled by the mutation's onError
    }
  }, [sendCommand, deviceUuid]);

  // ── Process completed command ─────────────────────────────────────────────

  useEffect(() => {
    if (!commandData) return;
    if (commandData.status !== 'COMPLETED' && commandData.status !== 'FAILED') return;

    const type    = pendingCommandType;
    const payload = commandData.responsePayload;
    const errMsg  = commandData.errorMessage;

    // Stop polling immediately
    setPendingCommandId(null);
    setPendingCommandType(null);

    if (commandData.status === 'FAILED') {
      toast({ variant: 'destructive', title: 'Command Failed', description: errMsg ?? 'Unknown error' });
      return;
    }
    if (!payload) return;

    try {
      const result: DeviceFileResponse = JSON.parse(payload);
      if (result.status !== 'success') {
        toast({ variant: 'destructive', title: 'Device Error', description: result.message });
        return;
      }

      switch (type) {
        case 'LIST_FILES': {
          const nodes = result.data as FileNode[] | undefined;
          if (Array.isArray(nodes)) {
            // If response is a single directory node, show its children (navigation into a folder)
            if (nodes.length === 1 && nodes[0].isDirectory) {
              setFileItems(sortNodes(nodes[0].children ?? []));
            } else {
              setFileItems(sortNodes(nodes));
            }
            setHasLoaded(true);
          }
          break;
        }
        case 'DELETE_FILE': {
          const deleted = selectedNodeRef.current;
          if (deleted) setFileItems((prev) => prev.filter((n) => n.path !== deleted.path));
          setSelectedNode(null);
          toast({ variant: 'success', title: 'Deleted', description: `"${deleted?.name}" removed.` });
          break;
        }
        case 'DOWNLOAD_FILE': {
          if (result.fileData) {
            triggerBase64Download(
              result.fileData,
              result.name ?? 'download',
              result.mimeType ?? 'application/octet-stream'
            );
            toast({ variant: 'success', title: 'Downloaded', description: result.name });
          }
          break;
        }
        case 'MOVE_FILE': {
          const moved = selectedNodeRef.current;
          if (moved) setFileItems((prev) => prev.filter((n) => n.path !== moved.path));
          setSelectedNode(null);
          setShowMoveInput(false);
          setMoveDest('');
          toast({ variant: 'success', title: 'Moved', description: `"${moved?.name}" moved.` });
          break;
        }
        case 'UPLOAD_FILE':
          setUploadFile(null);
          setShowUploadPanel(false);
          toast({ variant: 'success', title: 'Uploaded', description: result.message ?? 'File uploaded successfully.' });
          break;
        default:
          toast({ variant: 'success', title: 'Done', description: result.message });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Parse Error', description: 'Could not parse device response.' });
    }
  }, [commandData?.id, commandData?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handle completed HTTP file transfers ──────────────────────────────────

  useEffect(() => {
    if (!transferData) return;
    if (transferData.status !== 'COMPLETED' && transferData.status !== 'FAILED') return;

    const type = activeTransferType;
    const id = activeTransferId;

    setActiveTransferId(null);
    setActiveTransferType(null);

    if (transferData.status === 'FAILED') {
      toast({ variant: 'destructive', title: 'Transfer Failed', description: transferData.errorMessage ?? 'Unknown error' });
      return;
    }

    if ((type === 'DOWNLOAD' || type === 'VIEW') && transferData.downloadUrl) {
      const inline = type === 'VIEW';
      const url = `${transferData.downloadUrl}${inline ? '?inline=true' : ''}`;
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      if (!inline) a.download = transferData.fileName; // force-download only for DOWNLOAD
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast({ variant: 'success', title: inline ? 'Opening in browser…' : 'Downloading…', description: transferData.fileName });
    } else if (type === 'UPLOAD') {
      toast({ variant: 'success', title: 'Uploaded', description: `${transferData.fileName} sent to device.` });
    }
  }, [transferData?.id, transferData?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Navigation ────────────────────────────────────────────────────────────

  const navigateTo = useCallback((path: string) => {
    dispatchCommand('LIST_FILES', path ? { path } : {});
  }, [dispatchCommand]);

  const handleEnterFolder = (node: FileNode) => {
    setPathHistory((prev) => [...prev, currentPath]);
    setCurrentPath(node.path);
    setSelectedNode(null);
    navigateTo(node.path);
  };

  const handleBack = () => {
    const prev = pathHistory[pathHistory.length - 1] ?? '';
    setPathHistory((h) => h.slice(0, -1));
    setCurrentPath(prev);
    setSelectedNode(null);
    navigateTo(prev);
  };

  const handleHome = () => {
    setPathHistory([]);
    setCurrentPath('');
    setSelectedNode(null);
    navigateTo('');
  };

  const handleBreadcrumbNav = (path: string) => {
    // Build history as the chain of ancestor paths for `path`
    const segments = path.split('/').filter(Boolean);
    const newHistory: string[] = [''];
    for (let i = 0; i < segments.length - 1; i++) {
      newHistory.push('/' + segments.slice(0, i + 1).join('/'));
    }
    setPathHistory(newHistory);
    setCurrentPath(path);
    setSelectedNode(null);
    navigateTo(path);
  };

  const handleLoadRoot = () => navigateTo('');

  const handleRefresh = () => navigateTo(currentPath);

  // ── Breadcrumb segments ───────────────────────────────────────────────────

  const breadcrumbs = currentPath
    ? currentPath.split('/').filter(Boolean).map((seg, i, arr) => ({
        label: seg,
        path: '/' + arr.slice(0, i + 1).join('/'),
      }))
    : [];

  // ── File actions ──────────────────────────────────────────────────────────

  const handleDelete = () => {
    if (!selectedNode) return;
    if (!confirm(`Delete "${selectedNode.name}"?`)) return;
    dispatchCommand('DELETE_FILE', { path: selectedNode.path });
  };

  const handleDownload = async () => {
    if (!selectedNode || selectedNode.isDirectory) return;
    try {
      const res = await fileManagerService.requestDownload(deviceUuid, selectedNode.path);
      const transfer = res.data;
      if (transfer && transfer.status !== 'FAILED') {
        setActiveTransferId(transfer.id);
        setActiveTransferType('DOWNLOAD');
        toast({ variant: 'success', title: 'Downloading…', description: 'Device is uploading the file to the server.' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to request file download.' });
    }
  };

  const handleView = async () => {
    if (!selectedNode || selectedNode.isDirectory) return;
    try {
      const res = await fileManagerService.requestDownload(deviceUuid, selectedNode.path);
      const transfer = res.data;
      if (transfer && transfer.status !== 'FAILED') {
        setActiveTransferId(transfer.id);
        setActiveTransferType('VIEW');
        toast({ variant: 'success', title: 'Fetching file…', description: 'Will open in browser when ready.' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to request file.' });
    }
  };

  const handleMove = () => {
    if (!selectedNode || !moveDest.trim()) return;
    dispatchCommand('MOVE_FILE', { sourcePath: selectedNode.path, destinationPath: moveDest.trim() });
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    const destDir = selectedNode?.isDirectory ? selectedNode.path : currentPath || '/storage/emulated/0/Download';
    try {
      const res = await fileManagerService.uploadToDevice(deviceUuid, destDir, uploadFile);
      const transfer = res.data;
      if (transfer && transfer.status !== 'FAILED') {
        setActiveTransferId(transfer.id);
        setActiveTransferType('UPLOAD');
        setUploadFile(null);
        setShowUploadPanel(false);
        toast({ variant: 'success', title: 'Uploading\u2026', description: 'Device is downloading the file.' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to initiate upload.' });
    }
  };

  const isLoading = sendCommand.isPending || pendingCommandId !== null || activeTransferId !== null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Section tabs */}
      <div className="flex items-center gap-1">
        <button
          className={`text-sm px-3 py-1.5 rounded-md transition-colors ${
            activeSection === 'explorer' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
          onClick={() => setActiveSection('explorer')}
        >
          Explorer
        </button>
        <button
          className={`text-sm px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
            activeSection === 'events' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
          onClick={() => setActiveSection('events')}
        >
          <Activity className="h-3.5 w-3.5" />
          Live Events
        </button>
      </div>

      {activeSection === 'events' ? (
        <EventsPanel events={events?.data?.content ?? []} />
      ) : (
        <>
          {/* ── Breadcrumb / navigation bar ─────────────────────────────── */}
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-3 py-2 min-h-[40px]">
            {/* Back */}
            <button
              onClick={handleBack}
              disabled={pathHistory.length === 0 || isLoading}
              title="Go back"
              className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            {/* Home */}
            <button
              onClick={handleHome}
              disabled={isLoading || (!hasLoaded && currentPath === '')}
              title="Root storage"
              className="p-1 rounded text-gray-400 hover:text-blue-400 hover:bg-white/10 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
            >
              <Home className="h-4 w-4" />
            </button>

            {/* Separator */}
            <div className="w-px h-4 bg-white/15" />

            {/* Breadcrumb segments */}
            {breadcrumbs.length === 0 ? (
              <span className="text-xs text-gray-600 italic">Root</span>
            ) : (
              <div className="flex items-center gap-0.5 overflow-hidden">
                {breadcrumbs.map((crumb, i) => (
                  <div key={crumb.path} className="flex items-center gap-0.5 min-w-0">
                    {i > 0 && <ChevronRight className="h-3 w-3 text-gray-600 shrink-0" />}
                    {i === breadcrumbs.length - 1 ? (
                      <span className="text-xs font-mono text-white font-medium truncate max-w-[160px]" title={crumb.path}>
                        {crumb.label}
                      </span>
                    ) : (
                      <button
                        onClick={() => handleBreadcrumbNav(crumb.path)}
                        disabled={isLoading}
                        title={crumb.path}
                        className="text-xs font-mono text-blue-400 hover:text-blue-300 truncate max-w-[100px] disabled:opacity-50 transition-colors"
                      >
                        {crumb.label}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Status indicator */}
            <div className="ml-auto shrink-0">
              {activeTransferId !== null && (
                <span className="flex items-center gap-1.5 text-xs text-purple-400">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Transferring…
                </span>
              )}
              {activeTransferId === null && isLoading && (
                <span className="flex items-center gap-1.5 text-xs text-blue-400">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Loading…
                </span>
              )}
              {!isLoading && pendingCommandId === null && pendingCommandType === null && commandData?.status === 'COMPLETED' && (
                <StatusBadge status="COMPLETED" />
              )}
            </div>
          </div>

          {/* ── Action toolbar (shown after first load) ─────────────────── */}
          {hasLoaded && (
            <div className="flex flex-wrap items-start gap-2">
              {/* Always-available actions */}
              <Button
                size="sm"
                variant="outline"
                className="border-white/20 text-gray-300 hover:text-white hover:bg-white/10"
                onClick={handleRefresh}
                disabled={isLoading}
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>

              <div className="h-8 w-px bg-white/15 self-center" />

              {/* Selection-dependent actions */}
              <Button
                size="sm"
                variant="ghost"
                className="text-gray-300 hover:text-white hover:bg-white/10"
                disabled={!selectedNode || selectedNode.isDirectory || isLoading}
                onClick={handleDownload}
                title="Save file to disk"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Download
              </Button>

              <Button
                size="sm"
                variant="ghost"
                className="text-gray-300 hover:text-blue-300 hover:bg-blue-500/10"
                disabled={!selectedNode || selectedNode.isDirectory || isLoading}
                onClick={handleView}
                title="Open file in browser (PDF, image, video, text…)"
              >
                <Eye className="h-3.5 w-3.5 mr-1.5 text-blue-400" />
                View
              </Button>

              <Button
                size="sm"
                variant="ghost"
                className="text-gray-300 hover:text-red-300 hover:bg-red-500/10"
                disabled={!selectedNode || isLoading}
                onClick={handleDelete}
                title="Delete selected"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5 text-red-400" />
                Delete
              </Button>

              <Button
                size="sm"
                variant="ghost"
                className="text-gray-300 hover:text-white hover:bg-white/10"
                disabled={!selectedNode || isLoading}
                onClick={() => { setShowMoveInput(!showMoveInput); setShowUploadPanel(false); }}
              >
                <MoveRight className="h-3.5 w-3.5 mr-1.5" />
                Move
              </Button>

              <Button
                size="sm"
                variant="ghost"
                className="text-gray-300 hover:text-green-300 hover:bg-green-500/10"
                disabled={isLoading}
                onClick={() => { setShowUploadPanel(!showUploadPanel); setShowMoveInput(false); }}
              >
                <Upload className="h-3.5 w-3.5 mr-1.5 text-green-400" />
                Upload
              </Button>

              {/* Move input panel */}
              {showMoveInput && (
                <div className="w-full flex gap-2 items-center mt-1 p-2 bg-white/5 rounded-lg border border-white/10">
                  <span className="text-xs text-gray-400 shrink-0">Move to:</span>
                  <Input
                    className="h-8 text-sm flex-1 bg-white/5 border-white/20 text-white placeholder-gray-500"
                    placeholder="Destination path…"
                    value={moveDest}
                    onChange={(e) => setMoveDest(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleMove()}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={handleMove}
                    disabled={!moveDest.trim() || isLoading}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Move
                  </Button>
                  <button
                    onClick={() => { setShowMoveInput(false); setMoveDest(''); }}
                    className="text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Upload panel */}
              {showUploadPanel && (
                <div className="w-full flex gap-2 items-center mt-1 p-2 bg-white/5 rounded-lg border border-white/10">
                  <Upload className="h-4 w-4 text-green-400 shrink-0" />
                  <input
                    type="file"
                    className="text-sm text-gray-300 flex-1 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-blue-600 file:text-white file:text-xs cursor-pointer"
                    onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  />
                  <span className="text-xs text-gray-500 shrink-0 truncate max-w-[140px]">
                    →{' '}
                    {selectedNode?.isDirectory
                      ? selectedNode.path
                      : currentPath || '/storage/emulated/0/Download'}
                  </span>
                  <Button
                    size="sm"
                    onClick={handleUpload}
                    disabled={!uploadFile || isLoading}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    Upload
                  </Button>
                  <button
                    onClick={() => { setShowUploadPanel(false); setUploadFile(null); }}
                    className="text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Selected file info strip ─────────────────────────────────── */}
          {selectedNode && (
            <div className="flex items-center gap-2 text-xs text-gray-400 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
              {selectedNode.isDirectory
                ? <Folder className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                : <FileText className="h-3.5 w-3.5 text-blue-300 shrink-0" />}
              <span className="font-mono truncate flex-1">{selectedNode.path}</span>
              {!selectedNode.isDirectory && (
                <span className="shrink-0 text-gray-500">{formatSize(selectedNode.size)}</span>
              )}
              <button
                onClick={() => setSelectedNode(null)}
                className="shrink-0 text-gray-600 hover:text-gray-400 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* ── File list ────────────────────────────────────────────────── */}
          {!hasLoaded ? (
            <div className="flex flex-col items-center justify-center flex-1 border border-dashed border-white/10 rounded-xl text-gray-600 gap-3">
              <HardDrive className="h-10 w-10 opacity-20" />
              <p className="text-sm">Browse the device's storage</p>
              <Button
                onClick={handleLoadRoot}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isLoading
                  ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Loading…</>
                  : <><HardDrive className="h-4 w-4 mr-2" />Load Files</>
                }
              </Button>
            </div>
          ) : (
            <Card className="bg-card-bg border border-white/10 flex-1 overflow-auto">
              {/* Column headers */}
              <div className="flex items-center gap-3 px-4 py-2 border-b border-white/5 text-xs text-gray-600 uppercase tracking-wide">
                <span className="w-4 shrink-0" />
                <span className="flex-1">Name</span>
                <span className="hidden sm:block w-12 text-right shrink-0">Type</span>
                <span className="w-16 text-right shrink-0">Size</span>
                <span className="hidden sm:block w-24 text-right shrink-0">Modified</span>
                <span className="w-3.5 shrink-0" />
              </div>

              {fileItems.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-gray-600 text-sm">
                  This folder is empty
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {fileItems.map((item) => (
                    <FileRow
                      key={item.path}
                      node={item}
                      isSelected={selectedNode?.path === item.path}
                      onSelect={() => setSelectedNode(item)}
                      onEnter={() => handleEnterFolder(item)}
                    />
                  ))}
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ── Events panel ──────────────────────────────────────────────────────────────

function EventsPanel({ events }: { events: import('@/types/file-manager.types').FileEventResponse[] }) {
  const typeStyle: Record<string, string> = {
    CREATED:  'text-green-400 bg-green-400/10 border-green-400/20',
    DELETED:  'text-red-400 bg-red-400/10 border-red-400/20',
    MODIFIED: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  };

  return (
    <Card className="bg-card-bg border border-white/10 flex-1 overflow-auto">
      <div className="p-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-blue-400" />
          Real-time File System Events
          <span className="ml-auto text-xs text-gray-600 font-normal">auto-refreshes every 15s</span>
        </h3>
        {events.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-gray-600">
            <Activity className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">No events yet. Events appear when files change on the device.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {events.map((ev) => (
              <div key={ev.id} className="flex items-center gap-3 text-xs py-2 border-b border-white/5 last:border-0">
                <span className={`px-1.5 py-0.5 rounded border text-xs font-medium shrink-0 ${typeStyle[ev.eventType] ?? 'text-gray-400 bg-white/5 border-white/10'}`}>
                  {ev.eventType}
                </span>
                <span className="font-mono text-gray-300 truncate flex-1" title={ev.filePath}>
                  {ev.filePath}
                </span>
                <span className="text-gray-500 shrink-0">
                  {new Date(ev.receivedAt).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function sortNodes(nodes: FileNode[]): FileNode[] {
  return [...nodes].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function triggerBase64Download(base64: string, filename: string, mimeType: string) {
  const byteChars = atob(base64);
  const byteArray = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteArray[i] = byteChars.charCodeAt(i);
  }
  const blob = new Blob([byteArray], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
