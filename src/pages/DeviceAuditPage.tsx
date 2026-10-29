import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import { useDevicesQuery } from '@/hooks/useDevices';
import { AuditLogTable } from '@/components/features/audit/AuditLogTable';
import { ROUTES } from '@/utils/constants';

export function DeviceAuditPage() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();
  const numericId = deviceId ? parseInt(deviceId, 10) : null;
  const { data: devices = [], isLoading } = useDevicesQuery();
  const device = devices.find((d) => d.id === numericId);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <button type="button" onClick={() => navigate(ROUTES.DASHBOARD, { state: { activeTab: 'devices' } })} className="p-2 -ml-1 rounded-md hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-900">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="h-8 w-8 rounded-md bg-blue-50 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate text-sm leading-tight">{device?.deviceName ?? 'Unknown Device'}</p>
            <p className="text-[10px] text-gray-500 truncate">Audit trail{device?.deviceUuid ? ` · ${device.deviceUuid}` : ''}</p>
          </div>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 py-4">
        {numericId !== null ? <AuditLogTable deviceId={numericId} /> : <p className="text-sm text-gray-500">Device not found.</p>}
      </div>
    </div>
  );
}
