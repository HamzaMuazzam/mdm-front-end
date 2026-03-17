import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationService } from '@/api/services/notification.service';
import { toast } from '@/hooks/useToast';
import type { NotificationQuery } from '@/types/notification.types';

const NOTIFICATIONS_QUERY_KEY = ['notifications'];
const NOTIFICATION_SETTINGS_QUERY_KEY = ['notificationSettings'];

export function useDeviceNotifications(deviceId: number | null, params: NotificationQuery, enabled = true) {
  return useQuery({
    queryKey: [...NOTIFICATIONS_QUERY_KEY, deviceId, params],
    queryFn: () => notificationService.getNotifications(deviceId!, params),
    enabled: enabled && !!deviceId,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export function useNotificationSettings(deviceId: number | null, enabled = true) {
  return useQuery({
    queryKey: [...NOTIFICATION_SETTINGS_QUERY_KEY, deviceId],
    queryFn: () => notificationService.getSettings(deviceId!),
    enabled: enabled && !!deviceId,
    staleTime: 30 * 1000,
  });
}

export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ deviceId, alertsEnabled }: { deviceId: number; alertsEnabled: boolean }) =>
      notificationService.updateSettings(deviceId, alertsEnabled),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [...NOTIFICATION_SETTINGS_QUERY_KEY, variables.deviceId] });
      toast({
        variant: 'success',
        title: 'Alert Settings Updated',
        description: data.alertsEnabled ? 'Alerts enabled for this device.' : 'Alerts disabled for this device.',
      });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.message || 'Failed to update alert settings.';
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: message,
      });
    },
  });
}
