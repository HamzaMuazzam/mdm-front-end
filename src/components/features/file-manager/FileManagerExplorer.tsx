import { useState, useCallback } from 'react';
import {
  Folder,
  FileText,
  Trash2,
  Download,
  Upload,
  MoveRight,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  CheckCircle,
  Clock,
  FolderOpen,
  HardDrive,
  Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useSendFileCommand, usePollCommand, useFileEventsByDevice } from '@/hooks/useFileManager';
import { toast } from '@/hooks/useToast';
import type {
  FileNode,
  FileCommandResponse,
  DeviceFileResponse,
  FileCommandType,
} from '@/types/file-manager.types';

// ── Props ─────────────────────────────────────────────────────────────────────

interface FileManagerExplorerProps {
  deviceUuid: string;
  deviceName?: string;
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: FileCommandResponse['status'] | null }) {
  if (!status) return null;
  const map = {
    PENDING:   { color: 'text-yellow-400', icon: <Clock className="h-3 w-3 mr-1" />,         label: 'Pending' },
    SENT:      { color: 'text-blue-400',   icon: <RefreshCw className="h-3 w-3 mr-1 animate-spin" />, label: 'Waiting…' },
    COMPLETED: { color: 'text-green-400',  icon: <CheckCircle className="h-3 w-3 mr-1" />,   label: 'Done' },
    FAILED:    { color: 'text-red-400',    icon: <AlertCircle className="h-3 w-3 mr-1" />,    label: 'Failed' },
  } as const;
  const s = map[status];
  return (
    <span className={`inline-flex items-center text-xs font-medium ${s.color}`}>
      {s.icon}{s.label}
    </span>
  );
}

// ── File-tree node ────────────────────────────────────────────────────────────

interface FileTreeNodeProps {
  node: FileNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string, isDir: boolean) => void;
}

function FileTreeNode({ node, depth, selectedPath, onSelect }: FileTreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const isSelected = selectedPath === node.path;

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.isDirectory) setExpanded(!expanded);
  };

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-1 px-2 rounded cursor-pointer text-sm hover:bg-white/5 transition-colors ${
          isSelected ? 'bg-blue-500/20 text-blue-300' : 'text-gray-300'
        }`}
        style={{ paddingLeft: `${(depth + 1) * 14}px` }}
        onClick={() => onSelect(node.path, node.isDirectory)}
      >
        {node.isDirectory ? (
          <span onClick={toggle} className="mr-1 text-gray-400">
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </span>
        ) : (
          <span className="mr-1 w-3" />
        )}
        {node.isDirectory
          ? (expanded ? <FolderOpen className="h-4 w-4 text-yellow-400 shrink-0" /> : <Folder className="h-4 w-4 text-yellow-400 shrink-0" />)
          : <FileText className="h-4 w-4 text-blue-300 shrink-0" />}
        <span className="ml-1 truncate max-w-[200px]" title={node.name}>
          {node.name}
        </span>
        {!node.isDirectory && (
          <span className="ml-auto text-xs text-gray-500 shrink-0">
            {formatSize(node.size)}
          </span>
        )}
      </div>
      {node.isDirectory && expanded && node.children.map((child) => (
        <FileTreeNode
          key={child.path}
          node={child}
          depth={depth + 1}
          selectedPath={selectedPath}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function FileManagerExplorer({ deviceUuid, deviceName }: FileManagerExplorerProps) {
  const [currentPath, setCurrentPath] = useState('');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedIsDir, setSelectedIsDir] = useState(false);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [pendingCommandId, setPendingCommandId] = useState<number | null>(null);
  const [pendingCommandType, setPendingCommandType] = useState<FileCommandType | null>(null);
  const [moveDest, setMoveDest] = useState('');
  const [showMoveInput, setShowMoveInput] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [activeSection, setActiveSection] = useState<'explorer' | 'events'>('explorer');

  const sendCommand = useSendFileCommand(deviceUuid);
  const { data: events } = useFileEventsByDevice(deviceUuid);

  // ── Poll result ───────────────────────────────────────────────────────────

  const { data: polledCommand } = usePollCommand(pendingCommandId, pendingCommandId !== null);

  const commandData = polledCommand?.data;

  // Process completed result
  if (
    commandData &&
    (commandData.status === 'COMPLETED' || commandData.status === 'FAILED') &&
    pendingCommandId !== null
  ) {
    if (commandData.status === 'COMPLETED' && commandData.responsePayload) {
      processCommandResult(pendingCommandType, commandData.responsePayload);
    } else if (commandData.status === 'FAILED') {
      toast({ variant: 'destructive', title: 'Command Failed', description: commandData.errorMessage ?? 'Unknown error' });
    }
    // Reset polling
    setPendingCommandId(null);
    setPendingCommandType(null);
  }

  function processCommandResult(type: FileCommandType | null, payload: string) {
    try {
      const result: DeviceFileResponse = JSON.parse(payload);
      if (result.status !== 'success') {
        toast({ variant: 'destructive', title: 'Device Error', description: result.message });
        return;
      }
      switch (type) {
        case 'LIST_FILES': {
          const data = result.data;
          if (Array.isArray(data)) setFileTree(data);
          else if (data) setFileTree([data]);
          toast({ variant: 'success', title: 'Files Loaded', description: 'File tree refreshed.' });
          break;
        }
        case 'DELETE_FILE':
          toast({ variant: 'success', title: 'Deleted', description: result.message });
          setSelectedPath(null);
          break;
        case 'DOWNLOAD_FILE': {
          if (result.fileData) {
            triggerBase64Download(result.fileData, result.name ?? 'download', result.mimeType ?? 'application/octet-stream');
            toast({ variant: 'success', title: 'Downloaded', description: `${result.name} saved.` });
          }
          break;
        }
        case 'UPLOAD_FILE':
        case 'MOVE_FILE':
        case 'GET_METADATA':
          toast({ variant: 'success', title: 'Success', description: result.message });
          break;
      }
    } catch {
      toast({ variant: 'destructive', title: 'Parse Error', description: 'Could not parse device response.' });
    }
  }

  // ── Dispatch helpers ──────────────────────────────────────────────────────

  const dispatch = useCallback(
    async (req: Parameters<typeof sendCommand.mutateAsync>[0]) => {
      const res = await sendCommand.mutateAsync(req);
      const cmd = res.data;
      if (cmd && cmd.status !== 'FAILED') {
        setPendingCommandId(cmd.id);
        setPendingCommandType(cmd.commandType);
      }
    },
    [sendCommand]
  );

  const handleListFiles = () => {
    dispatch({ deviceUuid, commandType: 'LIST_FILES', path: currentPath || undefined });
  };

  const handleListDirectory = (path: string) => {
    dispatch({ deviceUuid, commandType: 'LIST_FILES', path });
  };

  const handleDelete = () => {
    if (!selectedPath) return;
    if (!confirm(`Delete "${selectedPath}"?`)) return;
    dispatch({ deviceUuid, commandType: 'DELETE_FILE', path: selectedPath });
  };

  const handleDownload = () => {
    if (!selectedPath || selectedIsDir) return;
    dispatch({ deviceUuid, commandType: 'DOWNLOAD_FILE', path: selectedPath });
  };

  const handleMove = () => {
    if (!selectedPath || !moveDest.trim()) return;
    dispatch({ deviceUuid, commandType: 'MOVE_FILE', sourcePath: selectedPath, destinationPath: moveDest.trim() });
    setShowMoveInput(false);
    setMoveDest('');
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    const destDir = selectedIsDir ? selectedPath! : currentPath || '/storage/emulated/0/Download';
    const base64 = await fileToBase64(uploadFile);
    dispatch({ deviceUuid, commandType: 'UPLOAD_FILE', path: destDir, fileName: uploadFile.name, fileData: base64 });
    setUploadFile(null);
    setShowUploadPanel(false);
  };

  const handleSelect = (path: string, isDir: boolean) => {
    setSelectedPath(path);
    setSelectedIsDir(isDir);
    if (isDir) handleListDirectory(path);
  };

  const isLoading = sendCommand.isPending || (pendingCommandId !== null &&
    commandData?.status !== 'COMPLETED' && commandData?.status !== 'FAILED');

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-blue-400" />
            File Manager
            {deviceName && <span className="text-gray-400 text-sm font-normal">— {deviceName}</span>}
          </h2>
          <p className="text-sm text-gray-400 mt-1">Remote file browser for device <code className="text-xs bg-white/10 px-1 rounded">{deviceUuid}</code></p>
        </div>

        <div className="flex gap-2">
          <button
            className={`text-sm px-3 py-1.5 rounded ${activeSection === 'explorer' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setActiveSection('explorer')}
          >
            Explorer
          </button>
          <button
            className={`text-sm px-3 py-1.5 rounded flex items-center gap-1 ${activeSection === 'events' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setActiveSection('events')}
          >
            <Activity className="h-3 w-3" />
            Live Events
          </button>
        </div>
      </div>

      {activeSection === 'events' ? (
        <EventsPanel events={events?.data?.data?.content ?? []} />
      ) : (
        <>
          {/* Toolbar */}
          <Card className="bg-card-bg border border-white/10 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="h-8 text-sm w-64 bg-white/5 border-white/20 text-white placeholder-gray-500"
                placeholder="/storage/emulated/0/..."
                value={currentPath}
                onChange={(e) => setCurrentPath(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleListFiles()}
              />

              <Button
                size="sm"
                onClick={handleListFiles}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isLoading ? (
                  <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                )}
                {fileTree.length === 0 ? 'Load Files' : 'Refresh'}
              </Button>

              <div className="h-5 w-px bg-white/20" />

              <Button
                size="sm"
                variant="ghost"
                className="text-gray-300 hover:text-white hover:bg-white/10"
                disabled={!selectedPath || selectedIsDir || isLoading}
                onClick={handleDownload}
                title="Download selected file"
              >
                <Download className="h-3.5 w-3.5 mr-1" />
                Download
              </Button>

              <Button
                size="sm"
                variant="ghost"
                className="text-gray-300 hover:text-white hover:bg-white/10"
                disabled={!selectedPath || isLoading}
                onClick={handleDelete}
                title="Delete selected file or folder"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1 text-red-400" />
                Delete
              </Button>

              <Button
                size="sm"
                variant="ghost"
                className="text-gray-300 hover:text-white hover:bg-white/10"
                disabled={!selectedPath || isLoading}
                onClick={() => setShowMoveInput(!showMoveInput)}
                title="Move / rename"
              >
                <MoveRight className="h-3.5 w-3.5 mr-1" />
                Move
              </Button>

              <Button
                size="sm"
                variant="ghost"
                className="text-gray-300 hover:text-white hover:bg-white/10"
                onClick={() => setShowUploadPanel(!showUploadPanel)}
                disabled={isLoading}
                title="Upload a file to device"
              >
                <Upload className="h-3.5 w-3.5 mr-1 text-green-400" />
                Upload
              </Button>

              {pendingCommandId && (
                <StatusBadge status={commandData?.status ?? 'SENT'} />
              )}
            </div>

            {/* Move input */}
            {showMoveInput && (
              <div className="flex gap-2 mt-2">
                <Input
                  className="h-8 text-sm flex-1 bg-white/5 border-white/20 text-white placeholder-gray-500"
                  placeholder="Destination path…"
                  value={moveDest}
                  onChange={(e) => setMoveDest(e.target.value)}
                />
                <Button size="sm" onClick={handleMove} disabled={!moveDest.trim() || isLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white">
                  Move
                </Button>
              </div>
            )}

            {/* Upload panel */}
            {showUploadPanel && (
              <div className="flex gap-2 mt-2 items-center">
                <input
                  type="file"
                  className="text-sm text-gray-300 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-blue-600 file:text-white file:text-xs cursor-pointer"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                />
                <Button size="sm" onClick={handleUpload} disabled={!uploadFile || isLoading}
                  className="bg-green-600 hover:bg-green-700 text-white">
                  Upload
                </Button>
                <span className="text-xs text-gray-400">
                  to: {selectedIsDir && selectedPath ? selectedPath : (currentPath || '/storage/emulated/0/Download')}
                </span>
              </div>
            )}
          </Card>

          {/* Selected path info */}
          {selectedPath && (
            <div className="flex items-center gap-2 text-xs text-gray-400 bg-white/5 px-3 py-1.5 rounded border border-white/10">
              {selectedIsDir
                ? <Folder className="h-3 w-3 text-yellow-400" />
                : <FileText className="h-3 w-3 text-blue-300" />}
              <span className="font-mono truncate">{selectedPath}</span>
            </div>
          )}

          {/* File tree */}
          <Card className="bg-card-bg border border-white/10 flex-1 overflow-auto">
            {fileTree.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <HardDrive className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">Click <strong>Load Files</strong> to browse device storage</p>
                <p className="text-xs mt-1">Optionally enter a path to list a specific directory</p>
              </div>
            ) : (
              <div className="p-2">
                {fileTree.map((root) => (
                  <FileTreeNode
                    key={root.path}
                    node={root}
                    depth={0}
                    selectedPath={selectedPath}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

// ── Events panel ──────────────────────────────────────────────────────────────

function EventsPanel({ events }: { events: import('@/types/file-manager.types').FileEventResponse[] }) {
  const typeColor: Record<string, string> = {
    CREATED:  'text-green-400 bg-green-400/10',
    DELETED:  'text-red-400 bg-red-400/10',
    MODIFIED: 'text-blue-400 bg-blue-400/10',
  };

  return (
    <Card className="bg-card-bg border border-white/10 flex-1 overflow-auto">
      <div className="p-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-blue-400" />
          Real-time File System Events
        </h3>
        {events.length === 0 ? (
          <p className="text-center text-gray-500 text-sm py-8">No events yet. Events appear when files change on the device.</p>
        ) : (
          <div className="space-y-1">
            {events.map((ev) => (
              <div key={ev.id} className="flex items-center gap-3 text-xs py-1.5 border-b border-white/5">
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${typeColor[ev.eventType] ?? 'text-gray-400'}`}>
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

function formatSize(bytes: number): string {
  if (bytes === 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data URL prefix
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
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
