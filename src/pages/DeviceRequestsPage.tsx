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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20">
        <div className="px-4 sm:px-6">
          <div className="flex items-center h-16 gap-6">

            {/* Left: Breadcrumb + Device Info */}
            <div className="flex items-center gap-8 shrink-0">
              {/* Breadcrumb */}
              <nav className="flex items-center space-x-2 text-sm">
                <button onClick={handleBack} className="flex items-center text-slate-500 hover:text-slate-700">
                  <Home className="h-4 w-4" />
                </button>
                <ChevronRight className="h-4 w-4 text-slate-300" />
                <button onClick={handleBack} className="text-slate-500 hover:text-slate-700">
                  Devices
                </button>
                <ChevronRight className="h-4 w-4 text-slate-300" />
                <span className="text-slate-900 dark:text-white font-medium">
                  Requests
                </span>
              </nav>

              {device && (
                <div className="hidden md:flex items-center gap-4 pl-4 border-l border-slate-200 dark:border-slate-700">
                  <span className="text-sm font-medium">{device.model}</span>
                  <span className="text-sm font-mono">{device.deviceUuid}</span>
                  <span className="text-sm">{device.userName}</span>
                </div>
              )}
            </div>

            {/* Center: Search and Filters */}
            <div className="flex-1 flex items-center gap-3">
              <div className="relative w-full max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search by app name or package ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Status Filter */}
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="all">All Status</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>

              {/* Flag Filter */}
              <div className="relative">
                <select
                  value={flagFilter}
                  onChange={(e) => setFlagFilter(e.target.value)}
                  className="appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="all">All Requests</option>
                  <option value="include">Include Requests</option>
                  <option value="sensitive">Sensitive Settings</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>

              <div className="ml-2 text-sm text-slate-500 whitespace-nowrap">
                {filteredRequests.length} of {requests.length} requests
              </div>
            </div>

            {/* Right: Actions */}
            <div className="shrink-0">
              <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2">
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

          </div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-8 mb-8">
          {/* Page Title Section */}
          <div className="flex-1">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl shadow-lg shadow-orange-500/25">
                <FileText className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                  Device Requests
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Review blocked app requests and permissions
                </p>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:w-auto">
            <CompactStatCard
              icon={<Package className="h-4 w-4" />}
              label="Total"
              value={stats.total}
              color="blue"
            />
            <CompactStatCard
              icon={<Clock className="h-4 w-4" />}
              label="Pending"
              value={stats.pending}
              color="yellow"
            />
            <CompactStatCard
              icon={<Check className="h-4 w-4" />}
              label="Approved"
              value={stats.approved}
              color="green"
            />
            <CompactStatCard
              icon={<X className="h-4 w-4" />}
              label="Rejected"
              value={stats.rejected}
              color="red"
            />
          </div>
        </div>

        {/* Table */}
        <Card className="shadow-xl shadow-slate-200/50 dark:shadow-none border-0 overflow-hidden">
          <CardContent className="p-0">
            {isLoading ? (
              <LoadingSkeleton />
            ) : filteredRequests.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">App Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Package ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Device ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Device UUID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">App ID</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Include Request</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Access Sensitive Settings</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Reviewed By</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Reviewed At</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Remarks</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Created At</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Updated At</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredRequests.map((request) => (
                      <tr
                        key={request.id}
                        className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm">{request.id}</td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-slate-900 dark:text-white">{request.appName}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono text-slate-500">{request.packageId}</span>
                        </td>
                        <td className="px-4 py-3 text-sm">{request.deviceId}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono text-slate-500 max-w-[120px] truncate block" title={request.deviceUuid}>
                            {request.deviceUuid}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">{request.deviceApplicationId}</td>
                        <td className="px-4 py-3 text-center">
                          <FlagBadge active={request.isIncludingRequest} variant="include" />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <FlagBadge active={request.isSensitiveSettings} variant="sensitive" />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={request.reviewStatus} />
                        </td>
                        <td className="px-4 py-3 text-sm">{request.reviewedByName || '-'}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(request.reviewedAt)}</td>
                        <td className="px-4 py-3">
                          <span className="text-sm max-w-[150px] truncate block" title={request.reviewRemarks || ''}>
                            {request.reviewRemarks || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(request.createdAt)}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(request.updatedAt)}</td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(request)}
                            className="opacity-60 group-hover:opacity-100 transition-opacity"
                          >
                            <Pencil className="h-4 w-4 mr-1.5" />
                            Review
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : requests.length > 0 ? (
              <EmptySearchState query={searchQuery} onClear={() => setSearchQuery('')} />
            ) : (
              <EmptyState />
            )}
          </CardContent>
        </Card>
      </main>

      {/* Edit Slide-over Panel */}
      {editingRequest && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 transition-opacity"
            onClick={handleCloseEdit}
          />

          {/* Panel */}
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-40 overflow-hidden flex flex-col animate-in slide-in-from-right duration-300">
            {/* Panel Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Review Request
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    Approve or reject this request
                  </p>
                </div>
                <button
                  onClick={handleCloseEdit}
                  className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <X className="h-5 w-5 text-slate-500" />
                </button>
              </div>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Request Info Card */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
                    <Package className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {editingRequest.appName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {editingRequest.packageId}
                    </p>
                  </div>
                </div>
              </div>

              {/* Request Details */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">Request Details</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Request ID</p>
                    <p className="font-medium">#{editingRequest.id}</p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Current Status</p>
                    <StatusBadge status={editingRequest.reviewStatus} />
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Include Request</p>
                    <FlagBadge active={editingRequest.isIncludingRequest} variant="include" />
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Sensitive Settings</p>
                    <FlagBadge active={editingRequest.isSensitiveSettings} variant="sensitive" />
                  </div>
                </div>
              </div>

              {/* Review Form */}
              <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Review Decision
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setReviewStatus('APPROVED')}
                      className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${
                        reviewStatus === 'APPROVED'
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <Check className="h-5 w-5" />
                      <span className="font-medium">Approve</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewStatus('REJECTED')}
                      className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${
                        reviewStatus === 'REJECTED'
                          ? 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <X className="h-5 w-5" />
                      <span className="font-medium">Reject</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reviewRemarks" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Review Remarks
                  </Label>
                  <textarea
                    id="reviewRemarks"
                    value={reviewRemarks}
                    onChange={(e) => setReviewRemarks(e.target.value)}
                    placeholder="Enter your review remarks..."
                    rows={4}
                    className="flex w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm ring-offset-background placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </div>
            </div>

            {/* Panel Footer */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={handleCloseEdit}
                  className="flex-1"
                  disabled={reviewMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  className={`flex-1 ${
                    reviewStatus === 'APPROVED'
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700'
                      : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
                  }`}
                  disabled={reviewMutation.isPending}
                >
                  {reviewMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Submit Review
                    </>
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
interface CompactStatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'blue' | 'green' | 'red' | 'yellow';
}

function CompactStatCard({ icon, label, value, color }: CompactStatCardProps) {
  const colorClasses = {
    blue: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400',
    green: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400',
    red: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400',
    yellow: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400',
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-lg font-bold text-slate-900 dark:text-white leading-none">{value}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalizedStatus = status.toUpperCase();
  const statusConfig: Record<string, { bg: string; dot: string }> = {
    PENDING: { bg: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400', dot: 'bg-yellow-500' },
    APPROVED: { bg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400', dot: 'bg-emerald-500' },
    REJECTED: { bg: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400', dot: 'bg-red-500' },
    IN_REVIEW: { bg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400', dot: 'bg-blue-500' },
  };
  const config = statusConfig[normalizedStatus] || { bg: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300', dot: 'bg-slate-500' };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${config.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`}></span>
      {status}
    </span>
  );
}

function FlagBadge({ active, variant }: { active: boolean; variant: 'include' | 'sensitive' }) {
  if (active) {
    const variantClasses = {
      include: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400',
      sensitive: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400',
    };
    return (
      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${variantClasses[variant]}`}>
        <Check className="h-3.5 w-3.5" />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
      <X className="h-3.5 w-3.5" />
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 animate-pulse">
          <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-xl" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
          </div>
          <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded-full w-20" />
          <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded-full w-16" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
        <FileText className="h-8 w-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
        No Requests Found
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-sm">
        This device doesn't have any blocked app requests yet. Requests will appear here when users request access to blocked applications.
      </p>
    </div>
  );
}

function EmptySearchState({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
        <Search className="h-8 w-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
        No Results Found
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-sm mb-4">
        No requests match "<span className="font-medium">{query}</span>". Try a different search term.
      </p>
      <Button variant="outline" size="sm" onClick={onClear}>
        Clear Search
      </Button>
    </div>
  );
}
