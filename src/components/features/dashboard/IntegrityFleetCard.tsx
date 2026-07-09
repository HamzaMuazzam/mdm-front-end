import { useEffect, useRef } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useIntegrityFleetSummary } from '@/hooks/useDeviceIntegrity';
import { usePermissionStore } from '@/store/permissionStore';
import { useToast } from '@/hooks/useToast';

const numberFormatter = new Intl.NumberFormat('en-US');

/**
 * Fleet-wide integrity roll-up tile. Polls the backend summary and raises a live toast to
 * the admin the moment the number of compromised devices increases.
 */
export function IntegrityFleetCard() {
  const hasPermission = usePermissionStore((s) => s.hasPermission);
  const canRead = hasPermission('device-integrity:read');
  const { data } = useIntegrityFleetSummary(canRead);
  const { toast } = useToast();
  const prevCompromised = useRef<number | null>(null);

  const compromised = data?.compromised ?? 0;

  useEffect(() => {
    if (!data) return;
    const prev = prevCompromised.current;
    if (prev !== null && compromised > prev) {
      toast({
        title: 'Device compromise detected',
        description: `${compromised - prev} more device(s) flagged. ${compromised} device(s) currently compromised.`,
        variant: 'destructive',
      });
    }
    prevCompromised.current = compromised;
  }, [compromised, data, toast]);

  if (!canRead) return null;

  const danger = compromised > 0;

  return (
    <Card
      className={`rounded-lg shadow-sm border ${
        danger ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'
      }`}
    >
      <CardHeader className="pb-2">
        <CardDescription className="text-xs text-gray-500">Compromised Devices</CardDescription>
        <CardTitle className={`text-2xl font-semibold ${danger ? 'text-red-700' : 'text-gray-900'}`}>
          {numberFormatter.format(compromised)}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between pt-2">
        <span className="text-xs text-gray-500">
          {numberFormatter.format(data?.suspicious ?? 0)} suspicious ·{' '}
          {numberFormatter.format(data?.clean ?? 0)} clean
        </span>
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-full ${
            danger ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'
          }`}
        >
          <ShieldAlert className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
