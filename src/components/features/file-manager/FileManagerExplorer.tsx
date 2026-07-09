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
    PENDING:   { color: 'text-amber-700',  icon: <Clock className="h-3 w-3" />,                            label: 'Pending' },
    SENT:      { color: 'text-blue-700',   icon: <RefreshCw className="h-3 w-3 animate-spin" />,           label: 'Waiting…' },
    COMPLETED: { color: 'text-green-700',  icon: <CheckCircle className="h-3 w-3" />,                      label: 'Done' },
    FAILED:    { color: 'text-red-700',    icon: <AlertCircle className="h-3 w-3" />,                      label: 'Failed' },
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
          ? 'bg-blue-50 text-blue-700'
          : 'hover:bg-gray-50 text-gray-700'
      }`}
    >
      {node.isDirectory ? (
        <Folder className={`h-4 w-4 shrink-0 transition-colors ${isSelected ? 'text-blue-600' : 'text-blue-600 group-hover:text-blue-600'}`} />
      ) : (
        <FileText className={`h-4 w-4 shrink-0 ${isSelected ? 'text-blue-600' : 'text-gray-500'}`} />
      )}

      <span className="flex-1 text-sm truncate font-medium">
        {node.name}
      </span>

      {!node.isDirectory && (
        <>
          <span className="text-xs text-gray-500 shrink-0 uppercase">
            {node.extension || '—'}
          </span>
          <span className="text-xs text-gray-500 shrink-0 w-16 text-right">
            {formatSize(node.size)}
          </span>
        </>
      )}

      <span className="text-xs text-gray-500 shrink-0 w-24 text-right hidden sm:block">
        {new Date(node.lastModified).toLocaleDateString()}
      </span>

      {node.isDirectory && (
        <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-colors ${isSelected ? 'text-blue-600' : 'text-gray-400'}`} />
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
  const [moveSource, setMoveSource]           = useState<FileNode | null>(null);
  const [uploadFile, setUploadFile]           = useState<File | null>(null);
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [activeSection, setActiveSection]     = useState<'explorer' | 'events'>('explorer');
  const [activeTransferId, setActiveTransferId]         = useState<string | null>(null);
  const [activeTransferType, setActiveTransferType]     = useState<'DOWNLOAD' | 'VIEW' | 'UPLOAD' | null>(null);

  // Refs to avoid stale closures in effects
  const selectedNodeRef = useRef<FileNode | null>(null);
  useEffect(() => { selectedNodeRef.current = selectedNode; }, [selectedNode]);

  const currentPathRef = useRef(currentPath);
  useEffect(() => { currentPathRef.current = currentPath; }, [currentPath]);

  // Auto-scroll breadcrumb to the right so the current (deepest) segment is always visible
  const breadcrumbRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (breadcrumbRef.current) {
      breadcrumbRef.current.scrollLeft = breadcrumbRef.current.scrollWidth;
    }
  }, [currentPath]);

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
          const raw = result.data;
          if (Array.isArray(raw)) {
            // Root scan returns an array of top-level storage nodes
            if (raw.length === 1 && raw[0].isDirectory) {
              setFileItems(sortNodes(raw[0].children ?? []));
            } else {
              setFileItems(sortNodes(raw));
            }
          } else if (raw && typeof raw === 'object' && 'isDirectory' in raw) {
            // Folder navigation returns a single FileNode — show its children
            const node = raw as FileNode;
            setFileItems(sortNodes(node.children ?? []));
          }
          setHasLoaded(true);
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
          setSelectedNode(null);
          toast({ variant: 'success', title: 'Moved', description: `"${moved?.name}" moved.` });
          navigateTo(currentPathRef.current);
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
      // Refresh current directory so the new file appears
      navigateTo(currentPathRef.current);
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
    // In move mode: clicking a folder sets it as destination — don't clear moveSource
    if (showMoveInput) setMoveDest(node.path);
  };

  const cancelMove = () => {
    setShowMoveInput(false);
    setMoveSource(null);
    setMoveDest('');
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
    if (!moveSource || !moveDest.trim()) return;
    // destination is the folder path + original filename
    const dest = moveDest.trim().replace(/\/$/, '') + '/' + moveSource.name;
    dispatchCommand('MOVE_FILE', { sourcePath: moveSource.path, destinationPath: dest });
    cancelMove();
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    // Use the current browsed path as destination; fall back to root storage
    const destDir = currentPath || '/storage/emulated/0';
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
    <div className="flex flex-col gap-3 h-full pb-6">
      {/* Section tabs */}
      <div className="flex items-center gap-1">
        <button
          className={`text-sm px-3 py-1.5 rounded-md transition-colors ${
            activeSection === 'explorer' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveSection('explorer')}
        >
          Explorer
        </button>
        <button
          className={`text-sm px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
            activeSection === 'events' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-500 hover:text-gray-700'
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
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-3 py-2 min-h-[40px]">
            {/* Back */}
            <button
              onClick={handleBack}
              disabled={pathHistory.length === 0 || isLoading}
              title="Go back"
              className="p-1 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-25 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            {/* Home */}
            <button
              onClick={handleHome}
              disabled={isLoading || (!hasLoaded && currentPath === '')}
              title="Root storage"
              className="p-1 rounded-md text-gray-500 hover:text-blue-600 hover:bg-gray-100 disabled:opacity-25 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              <Home className="h-4 w-4" />
            </button>

            {/* Separator */}
            <div className="w-px h-4 bg-gray-200 shrink-0" />

            {/* Breadcrumb segments — scrollable so long paths are never clipped */}
            {breadcrumbs.length === 0 ? (
              <span className="text-xs text-gray-400 italic">Root</span>
            ) : (
              <div ref={breadcrumbRef} className="flex items-center gap-0.5 overflow-x-auto scrollbar-none min-w-0 flex-1">
                {breadcrumbs.map((crumb, i) => (
                  <div key={crumb.path} className="flex items-center gap-0.5 shrink-0">
                    {i > 0 && <ChevronRight className="h-3 w-3 text-gray-400 shrink-0" />}
                    {i === breadcrumbs.length - 1 ? (
                      <span className="text-xs font-mono text-gray-900 font-medium whitespace-nowrap" title={crumb.path}>
                        {crumb.label}
                      </span>
                    ) : (
                      <button
                        onClick={() => handleBreadcrumbNav(crumb.path)}
                        disabled={isLoading}
                        title={crumb.path}
                        className="text-xs font-mono text-blue-600 hover:text-blue-700 whitespace-nowrap disabled:opacity-50 transition-colors"
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
                <span className="flex items-center gap-1.5 text-xs text-blue-600">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Transferring…
                </span>
              )}
              {activeTransferId === null && isLoading && (
                <span className="flex items-center gap-1.5 text-xs text-blue-600">
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
                className="border-gray-300 bg-white text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                onClick={handleRefresh}
                disabled={isLoading}
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>

              <div className="h-8 w-px bg-gray-200 self-center" />

              {/* Selection-dependent actions */}
              <Button
                size="sm"
                variant="ghost"
                className="text-gray-700 hover:text-gray-900 hover:bg-gray-50"
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
                className="text-gray-700 hover:text-blue-700 hover:bg-blue-50"
                disabled={!selectedNode || selectedNode.isDirectory || isLoading}
                onClick={handleView}
                title="Open file in browser (PDF, image, video, text…)"
              >
                <Eye className="h-3.5 w-3.5 mr-1.5 text-blue-600" />
                View
              </Button>

              <Button
                size="sm"
                variant="ghost"
                className="text-gray-700 hover:text-red-700 hover:bg-red-50"
                disabled={!selectedNode || isLoading}
                onClick={handleDelete}
                title="Delete selected"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5 text-red-600" />
                Delete
              </Button>

              <Button
                size="sm"
                variant="ghost"
                className="text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                disabled={!selectedNode || isLoading}
                onClick={() => {
                  const opening = !showMoveInput;
                  setShowMoveInput(opening);
                  setShowUploadPanel(false);
                  if (opening) {
                    setMoveSource(selectedNode);
                    setMoveDest('');   // clear so user navigates to pick destination
                  } else {
                    cancelMove();
                  }
                }}
              >
                <MoveRight className="h-3.5 w-3.5 mr-1.5" />
                Move
              </Button>

              <Button
                size="sm"
                variant="ghost"
                className="text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                disabled={isLoading}
                onClick={() => { setShowUploadPanel(!showUploadPanel); setShowMoveInput(false); }}
              >
                <Upload className="h-3.5 w-3.5 mr-1.5 text-gray-500" />
                Upload
              </Button>

              {/* Move panel */}
              {showMoveInput && moveSource && (
                <div className="w-full flex flex-col gap-2 mt-1 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  {/* Source file */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500 shrink-0">Moving:</span>
                    <span className="font-mono text-gray-900 truncate">{moveSource.path}</span>
                  </div>
                  {/* Destination row */}
                  <div className="flex gap-2 items-center">
                    <span className="text-xs text-gray-500 shrink-0">To:</span>
                    <Input
                      className="h-9 text-sm flex-1 rounded-md bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-primary"
                      placeholder="Navigate into a folder or type path…"
                      value={moveDest}
                      onChange={(e) => setMoveDest(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleMove()}
                    />
                    <Button
                      size="sm"
                      onClick={handleMove}
                      disabled={!moveDest.trim() || isLoading}
                      className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm shrink-0"
                    >
                      Move here
                    </Button>
                    <button
                      onClick={cancelMove}
                      className="text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-xs text-blue-700">
                    Navigate into a folder — it will appear in the "To:" field automatically.
                  </p>
                </div>
              )}

              {/* Upload panel */}
              {showUploadPanel && (
                <div className="w-full flex gap-2 items-center mt-1 p-2 bg-gray-50 rounded-lg border border-gray-200">
                  <Upload className="h-4 w-4 text-gray-500 shrink-0" />
                  <input
                    type="file"
                    className="text-sm text-gray-700 flex-1 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:bg-blue-600 file:text-white file:text-xs cursor-pointer"
                    onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  />
                  <span className="text-xs text-gray-500 shrink-0 truncate max-w-[140px]">
                    → {currentPath || '/storage/emulated/0'}
                  </span>
                  <Button
                    size="sm"
                    onClick={handleUpload}
                    disabled={!uploadFile || isLoading}
                    className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                  >
                    Upload
                  </Button>
                  <button
                    onClick={() => { setShowUploadPanel(false); setUploadFile(null); }}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Selected file info strip ─────────────────────────────────── */}
          {selectedNode && (
            <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 px-3 py-1.5 rounded-md border border-gray-200">
              {selectedNode.isDirectory
                ? <Folder className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                : <FileText className="h-3.5 w-3.5 text-gray-500 shrink-0" />}
              <span className="font-mono truncate flex-1">{selectedNode.path}</span>
              {!selectedNode.isDirectory && (
                <span className="shrink-0 text-gray-500">{formatSize(selectedNode.size)}</span>
              )}
              <button
                onClick={() => setSelectedNode(null)}
                className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* ── File list ────────────────────────────────────────────────── */}
          {!hasLoaded ? (
            <div className="flex flex-col items-center justify-center flex-1 border border-dashed border-gray-300 rounded-lg text-gray-400 gap-3">
              <HardDrive className="h-10 w-10 opacity-20" />
              <p className="text-sm">Browse the device's storage</p>
              <Button
                onClick={handleLoadRoot}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
              >
                {isLoading
                  ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Loading…</>
                  : <><HardDrive className="h-4 w-4 mr-2" />Load Files</>
                }
              </Button>
            </div>
          ) : (
            <Card className="bg-white border border-gray-200 rounded-lg shadow-sm flex-1 overflow-auto">
              {/* Column headers */}
              <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
                <span className="w-4 shrink-0" />
                <span className="flex-1">Name</span>
                <span className="hidden sm:block w-12 text-right shrink-0">Type</span>
                <span className="w-16 text-right shrink-0">Size</span>
                <span className="hidden sm:block w-24 text-right shrink-0">Modified</span>
                <span className="w-3.5 shrink-0" />
              </div>

              {fileItems.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
                  This folder is empty
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
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
    CREATED:  'text-green-700 bg-green-50 border-green-200',
    DELETED:  'text-red-700 bg-red-50 border-red-200',
    MODIFIED: 'text-blue-700 bg-blue-50 border-blue-200',
  };

  return (
    <Card className="bg-white border border-gray-200 rounded-lg shadow-sm flex-1 overflow-auto">
      <div className="p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-blue-600" />
          Real-time File System Events
          <span className="ml-auto text-xs text-gray-500 font-normal">auto-refreshes every 15s</span>
        </h3>
        {events.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-gray-400">
            <Activity className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">No events yet. Events appear when files change on the device.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {events.map((ev) => (
              <div key={ev.id} className="flex items-center gap-3 text-xs py-2 border-b border-gray-100 last:border-0">
                <span className={`px-1.5 py-0.5 rounded border text-xs font-medium shrink-0 ${typeStyle[ev.eventType] ?? 'text-gray-700 bg-gray-100 border-gray-200'}`}>
                  {ev.eventType}
                </span>
                <span className="font-mono text-gray-700 truncate flex-1" title={ev.filePath}>
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
