import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBlockedAppRequests, useDevicesQuery, useReviewBlockedAppRequest } from '@/hooks/useDevices';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  FileText,
  Package,
  Check,
  X,
  Pencil,
  Save,
  Search,
  RefreshCw,
  ChevronRight,
  Home,
  Clock,
  ChevronDown,
} from 'lucide-react';
import { ROUTES } from '@/utils/constants';
import type { BlockedAppRequest } from '@/types/device.types';

export function DeviceRequestsPage() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();
  const numericDeviceId = deviceId ? parseInt(deviceId, 10) : null;

  const { data: devices = [] } = useDevicesQuery();
  const { data: requests = [], isLoading, refetch } = useBlockedAppRequests(numericDeviceId);
  const reviewMutation = useReviewBlockedAppRequest();

  const device = devices.find(d => d.id === numericDeviceId);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [flagFilter, setFlagFilter] = useState<string>('all');

  // Edit state
  const [editingRequest, setEditingRequest] = useState<BlockedAppRequest | null>(null);
  const [reviewStatus, setReviewStatus] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [reviewRemarks, setReviewRemarks] = useState('');

  // Filtered requests based on search and filters
  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        if (!req.appName.toLowerCase().includes(query) &&
            !req.packageId.toLowerCase().includes(query)) {
          return false;
        }
      }
      // Status filter
      if (statusFilter !== 'all' && req.reviewStatus.toUpperCase() !== statusFilter.toUpperCase()) {
        return false;
      }
      // Flag filter
      if (flagFilter === 'include' && !req.isIncludingRequest) {
        return false;
      }
      if (flagFilter === 'sensitive' && !req.isSensitiveSettings) {
        return false;
      }
      return true;
    });
  }, [requests, searchQuery, statusFilter, flagFilter]);

  const handleBack = () => {
    navigate(ROUTES.DASHBOARD, { state: { activeTab: 'devices' } });
  };

  const handleEdit = (request: BlockedAppRequest) => {
    setEditingRequest(request);
    setReviewStatus('APPROVED');
    setReviewRemarks(request.reviewRemarks || '');
  };

  const handleCloseEdit = () => {
    setEditingRequest(null);
    setReviewStatus('APPROVED');
    setReviewRemarks('');
  };

  const handleSave = async () => {
    if (!editingRequest) return;
    try {
      await reviewMutation.mutateAsync({
        requestId: editingRequest.id,
        status: reviewStatus,
        reviewRemarks: reviewRemarks,
      });
      handleCloseEdit();
    } catch (err) {
      console.error('Failed to review request', err);
    }
  };

  const handleRefresh = () => {
    refetch();
  };

  // Stats
  const stats = useMemo(() => ({
    total: requests.length,
    pending: requests.filter(r => r.reviewStatus.toUpperCase() === 'PENDING').length,
    approved: requests.filter(r => r.reviewStatus.toUpperCase() === 'APPROVED').length,
    rejected: requests.filter(r => r.reviewStatus.toUpperCase() === 'REJECTED').length,
  }), [requests]);

  // Format date helper
  const formatDateTime = (dateString: string | null): string => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="px-4 sm:px-6">
          {/* Row 1: breadcrumb + device info (md) + refresh */}
          <div className="flex items-center justify-between gap-3 h-12 sm:h-14">
            <nav className="flex items-center space-x-2 text-sm min-w-0">
              <button onClick={handleBack} className="flex items-center text-muted-foreground hover:text-foreground shrink-0">
                <Home className="h-4 w-4" />
              </button>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              <button onClick={handleBack} className="text-muted-foreground hover:text-foreground shrink-0">
                Devices
              </button>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-medium truncate">Requests</span>
            </nav>
            {device && (
              <div className="hidden md:flex items-center gap-4 pl-4 border-l border-border shrink-0">
                <span className="text-sm font-medium">{device.model}</span>
                <span className="text-sm font-mono">{device.deviceUuid}</span>
                <span className="text-sm">{device.userName}</span>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2 shrink-0">
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
          {/* Row 2: search + filters */}
          <div className="flex items-center gap-2 pb-3 flex-wrap">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search apps..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none h-9 bg-white border border-gray-300 rounded-md px-3 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={flagFilter}
                onChange={(e) => setFlagFilter(e.target.value)}
                className="appearance-none h-9 bg-white border border-gray-300 rounded-md px-3 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
              >
                <option value="all">All Types</option>
                <option value="include">Include</option>
                <option value="sensitive">Sensitive</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
            <div className="text-xs text-muted-foreground whitespace-nowrap">
              {filteredRequests.length}/{requests.length}
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-6 pb-10">

        {/* ── Page title + stats ───────────────────────────────────────── */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 rounded-md">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Device Requests</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Review blocked app requests and permissions</p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            <StatPill label="Total" value={stats.total} color="blue" />
            <StatPill label="Pending" value={stats.pending} color="yellow" />
            <StatPill label="Approved" value={stats.approved} color="green" />
            <StatPill label="Rejected" value={stats.rejected} color="red" />
          </div>
        </div>

        {/* ── Content ──────────────────────────────────────────────────── */}
        {isLoading ? (
          <LoadingSkeleton />
        ) : filteredRequests.length > 0 ? (
          <>
            {/* ── Mobile: beautiful cards ───────────────────────── */}
            <div className="flex flex-col gap-3 md:hidden">
              {filteredRequests.map((request) => {
                const status = request.reviewStatus.toUpperCase();
                const accentClass =
                  status === 'APPROVED' ? 'border-l-green-500' :
                  status === 'REJECTED' ? 'border-l-red-500' :
                  status === 'PENDING'  ? 'border-l-amber-400' : 'border-l-gray-200';
                const avatarGradient =
                  status === 'APPROVED' ? 'bg-green-50 text-green-700' :
                  status === 'REJECTED' ? 'bg-red-50 text-red-700' :
                  'bg-amber-50 text-amber-700';

                return (
                  <div
                    key={request.id}
                    className={`rounded-lg border border-gray-200 border-l-4 ${accentClass} bg-white shadow-sm overflow-hidden`}
                  >
                    {/* Card top: avatar + name + status + action */}
                    <div className="flex items-start gap-3 p-4 pb-3">
                      {/* App avatar */}
                      <div className={`w-11 h-11 rounded-md ${avatarGradient} flex items-center justify-center shrink-0`}>
                        <span className="font-semibold text-base">
                          {(request.appName || '?').charAt(0).toUpperCase()}
                        </span>
                      </div>
                      {/* Name + package */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-foreground leading-tight truncate">{request.appName}</p>
                        <p className="text-[11px] font-mono text-muted-foreground truncate mt-0.5">{request.packageId}</p>
                      </div>
                      {/* Status badge */}
                      <StatusBadge status={request.reviewStatus} />
                    </div>

                    {/* Flags row */}
                    <div className="flex items-center gap-2 px-4 pb-3 flex-wrap">
                      {request.isIncludingRequest && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-medium">
                          <Check className="h-3 w-3" /> Include Request
                        </span>
                      )}
                      {request.isSensitiveSettings && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 text-[11px] font-medium">
                          <Check className="h-3 w-3" /> Sensitive Settings
                        </span>
                      )}
                      {!request.isIncludingRequest && !request.isSensitiveSettings && (
                        <span className="text-[11px] text-muted-foreground italic">No special flags</span>
                      )}
                    </div>

                    {/* Divider + meta grid */}
                    <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                      <div>
                        <span className="text-muted-foreground">Request ID</span>
                        <p className="font-medium text-foreground">#{request.id}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">App ID</span>
                        <p className="font-medium text-foreground">{request.deviceApplicationId}</p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Device UUID</span>
                        <p className="font-mono text-foreground truncate">{request.deviceUuid}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Created</span>
                        <p className="text-foreground">{formatDateTime(request.createdAt)}</p>
                      </div>
                      {request.reviewedByName && (
                        <div>
                          <span className="text-muted-foreground">Reviewed by</span>
                          <p className="font-medium text-foreground truncate">{request.reviewedByName}</p>
                        </div>
                      )}
                      {request.reviewedAt && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Reviewed at</span>
                          <p className="text-foreground">{formatDateTime(request.reviewedAt)}</p>
                        </div>
                      )}
                      {request.reviewRemarks && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Remarks</span>
                          <p className="text-foreground italic truncate">"{request.reviewRemarks}"</p>
                        </div>
                      )}
                    </div>

                    {/* Action footer */}
                    <div className="px-4 py-2.5 border-t border-gray-100 flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(request)}
                        className="h-8 gap-1.5 text-xs"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Review Request
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Desktop table ─────────────────────────────────── */}
            <Card className="hidden md:block shadow-sm border overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">App</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Package ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Device ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Device UUID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">App ID</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wide">Include</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wide">Sensitive</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Reviewed By</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Reviewed At</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Remarks</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Created At</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Updated At</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredRequests.map((request) => (
                        <tr key={request.id} className="group hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm text-muted-foreground">#{request.id}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center shrink-0">
                                <span className="text-blue-600 text-xs font-semibold">{(request.appName||'?').charAt(0).toUpperCase()}</span>
                              </div>
                              <span className="font-medium text-foreground text-sm">{request.appName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3"><span className="text-xs font-mono text-muted-foreground">{request.packageId}</span></td>
                          <td className="px-4 py-3 text-sm text-foreground">{request.deviceId}</td>
                          <td className="px-4 py-3"><span className="text-xs font-mono text-muted-foreground max-w-[120px] truncate block" title={request.deviceUuid}>{request.deviceUuid}</span></td>
                          <td className="px-4 py-3 text-sm text-foreground">{request.deviceApplicationId}</td>
                          <td className="px-4 py-3 text-center"><FlagBadge active={request.isIncludingRequest} variant="include" /></td>
                          <td className="px-4 py-3 text-center"><FlagBadge active={request.isSensitiveSettings} variant="sensitive" /></td>
                          <td className="px-4 py-3 text-center"><StatusBadge status={request.reviewStatus} /></td>
                          <td className="px-4 py-3 text-sm text-foreground">{request.reviewedByName || '-'}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(request.reviewedAt)}</td>
                          <td className="px-4 py-3"><span className="text-sm text-foreground max-w-[150px] truncate block" title={request.reviewRemarks || ''}>{request.reviewRemarks || '-'}</span></td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(request.createdAt)}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(request.updatedAt)}</td>
                          <td className="px-4 py-3 text-right">
                            <Button size="sm" variant="ghost" onClick={() => handleEdit(request)} className="opacity-60 group-hover:opacity-100 transition-opacity">
                              <Pencil className="h-4 w-4 mr-1.5" />Review
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        ) : requests.length > 0 ? (
          <EmptySearchState query={searchQuery} onClear={() => setSearchQuery('')} />
        ) : (
          <EmptyState />
        )}
      </main>

      {/* Review Slide-over Panel */}
      {editingRequest && (
        <>
          <div className="fixed inset-0 bg-black/30 z-30" onClick={handleCloseEdit} />
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white border-l border-gray-200 shadow-lg z-40 overflow-hidden flex flex-col">

            {/* Panel header with status stripe */}
            <div className={`px-6 pt-5 pb-4 border-b border-border ${
              editingRequest.reviewStatus.toUpperCase() === 'APPROVED' ? 'bg-green-50' :
              editingRequest.reviewStatus.toUpperCase() === 'REJECTED' ? 'bg-red-50' :
              'bg-amber-50'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-md bg-blue-50 flex items-center justify-center shrink-0">
                    <span className="text-blue-600 font-semibold text-xl">
                      {(editingRequest.appName || '?').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground leading-tight truncate">{editingRequest.appName}</p>
                    <p className="text-xs font-mono text-muted-foreground truncate mt-0.5">{editingRequest.packageId}</p>
                    <div className="mt-1.5"><StatusBadge status={editingRequest.reviewStatus} /></div>
                  </div>
                </div>
                <button onClick={handleCloseEdit} className="p-2 rounded-lg hover:bg-muted transition-colors shrink-0">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">

              {/* Details grid */}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Request Details</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md bg-gray-50 border border-gray-200 p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Request ID</p>
                    <p className="font-semibold text-foreground text-sm">#{editingRequest.id}</p>
                  </div>
                  <div className="rounded-md bg-gray-50 border border-gray-200 p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">App ID</p>
                    <p className="font-semibold text-foreground text-sm">{editingRequest.deviceApplicationId}</p>
                  </div>
                  <div className="rounded-md bg-gray-50 border border-gray-200 p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Include Request</p>
                    <div className="mt-0.5"><FlagBadge active={editingRequest.isIncludingRequest} variant="include" /></div>
                  </div>
                  <div className="rounded-md bg-gray-50 border border-gray-200 p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Sensitive Settings</p>
                    <div className="mt-0.5"><FlagBadge active={editingRequest.isSensitiveSettings} variant="sensitive" /></div>
                  </div>
                  <div className="col-span-2 rounded-md bg-gray-50 border border-gray-200 p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Device UUID</p>
                    <p className="font-mono text-xs text-foreground break-all">{editingRequest.deviceUuid}</p>
                  </div>
                  <div className="col-span-2 rounded-md bg-gray-50 border border-gray-200 p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Submitted</p>
                    <p className="text-sm text-foreground">{formatDateTime(editingRequest.createdAt)}</p>
                  </div>
                </div>
              </div>

              {/* Decision */}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Your Decision</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setReviewStatus('APPROVED')}
                    className={`flex flex-col items-center justify-center gap-1.5 p-4 rounded-md border-2 transition-all ${
                      reviewStatus === 'APPROVED'
                        ? 'border-green-500 bg-green-50 text-green-700 shadow-sm'
                        : 'border-gray-200 hover:border-green-300 text-gray-500'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${reviewStatus === 'APPROVED' ? 'bg-green-500' : 'bg-gray-100'}`}>
                      <Check className={`h-5 w-5 ${reviewStatus === 'APPROVED' ? 'text-white' : 'text-muted-foreground'}`} />
                    </div>
                    <span className="text-sm font-semibold">Approve</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewStatus('REJECTED')}
                    className={`flex flex-col items-center justify-center gap-1.5 p-4 rounded-md border-2 transition-all ${
                      reviewStatus === 'REJECTED'
                        ? 'border-red-500 bg-red-50 text-red-700 shadow-sm'
                        : 'border-gray-200 hover:border-red-300 text-gray-500'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${reviewStatus === 'REJECTED' ? 'bg-red-500' : 'bg-gray-100'}`}>
                      <X className={`h-5 w-5 ${reviewStatus === 'REJECTED' ? 'text-white' : 'text-muted-foreground'}`} />
                    </div>
                    <span className="text-sm font-semibold">Reject</span>
                  </button>
                </div>
              </div>

              {/* Remarks */}
              <div>
                <Label htmlFor="reviewRemarks" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Review Remarks <span className="normal-case font-normal">(optional)</span>
                </Label>
                <textarea
                  id="reviewRemarks"
                  value={reviewRemarks}
                  onChange={(e) => setReviewRemarks(e.target.value)}
                  placeholder="Add a note explaining your decision..."
                  rows={4}
                  className="mt-2 flex w-full rounded-md border border-gray-300 bg-white px-4 py-3 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 resize-none"
                />
              </div>
            </div>

            {/* Panel footer */}
            <div className="px-5 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex gap-3">
                <Button variant="outline" onClick={handleCloseEdit} className="flex-1" disabled={reviewMutation.isPending}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={reviewMutation.isPending}
                  className={`flex-1 text-white shadow-sm ${
                    reviewStatus === 'APPROVED'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {reviewMutation.isPending ? (
                    <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Submitting...</>
                  ) : (
                    <><Save className="h-4 w-4 mr-2" />Submit Review</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Helper Components
function StatPill({ label, value, color }: { label: string; value: number; color: 'blue' | 'green' | 'red' | 'yellow' }) {
  const cfg = {
    blue:   'bg-white text-gray-900 border-gray-200',
    green:  'bg-white text-gray-900 border-gray-200',
    red:    'bg-white text-gray-900 border-gray-200',
    yellow: 'bg-white text-gray-900 border-gray-200',
  };
  return (
    <div className={`flex flex-col items-center justify-center rounded-lg border shadow-sm px-3 py-2 ${cfg[color]}`}>
      <span className="text-xl font-semibold leading-none">{value}</span>
      <span className="text-[10px] font-medium mt-0.5 uppercase tracking-wide text-gray-500">{label}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalizedStatus = status.toUpperCase();
  const statusConfig: Record<string, { bg: string; dot: string }> = {
    PENDING: { bg: 'bg-amber-50 text-amber-700 border border-amber-200', dot: 'bg-amber-500' },
    APPROVED: { bg: 'bg-green-50 text-green-700 border border-green-200', dot: 'bg-green-500' },
    REJECTED: { bg: 'bg-red-50 text-red-700 border border-red-200', dot: 'bg-red-500' },
    IN_REVIEW: { bg: 'bg-blue-50 text-blue-700 border border-blue-200', dot: 'bg-blue-500' },
  };
  const config = statusConfig[normalizedStatus] || { bg: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400' };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`}></span>
      {status}
    </span>
  );
}

function FlagBadge({ active, variant }: { active: boolean; variant: 'include' | 'sensitive' }) {
  if (active) {
    const variantClasses = {
      include: 'bg-blue-50 text-blue-600 border border-blue-200',
      sensitive: 'bg-red-50 text-red-600 border border-red-200',
    };
    return (
      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${variantClasses[variant]}`}>
        <Check className="h-3.5 w-3.5" />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-400">
      <X className="h-3.5 w-3.5" />
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 animate-pulse">
          <div className="w-10 h-10 bg-gray-200 rounded-md" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-1/3" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
          </div>
          <div className="h-6 bg-gray-200 rounded-full w-20" />
          <div className="h-6 bg-gray-200 rounded-full w-16" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
        <FileText className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">
        No Requests Found
      </h3>
      <p className="text-sm text-gray-500 text-center max-w-sm">
        This device doesn't have any blocked app requests yet. Requests will appear here when users request access to blocked applications.
      </p>
    </div>
  );
}

function EmptySearchState({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
        <Search className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">
        No Results Found
      </h3>
      <p className="text-sm text-gray-500 text-center max-w-sm mb-4">
        No requests match "<span className="font-medium">{query}</span>". Try a different search term.
      </p>
      <Button variant="outline" size="sm" onClick={onClear}>
        Clear Search
      </Button>
    </div>
  );
}
