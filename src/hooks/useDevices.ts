import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { deviceService } from '@/api/services/device.service';
import { toast } from '@/hooks/useToast';
import type { CreateDeviceRequest, UpdateDeviceRequest, UpdateDeviceConfigurationRequest } from '@/types/device.types';

const DEVICES_QUERY_KEY = ['devices'];

export function useDevicesQuery() {
  return useQuery({
    queryKey: DEVICES_QUERY_KEY,
    queryFn: deviceService.getAllDevices,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCreateDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateDeviceRequest) => deviceService.createDevice(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DEVICES_QUERY_KEY });
      toast({
        variant: 'success',
        title: 'Device Created',
        description: 'Device has been created successfully.',
      });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.message || 'Failed to create device. Please try again.';
      toast({
        variant: 'destructive',
        title: 'Create Error',
        description: message,
      });
    },
  });
}

export function useUpdateDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateDeviceRequest & { id: number }) =>
      deviceService.updateDevice(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DEVICES_QUERY_KEY });
      toast({
        variant: 'success',
        title: 'Device Updated',
        description: 'Device has been updated successfully.',
      });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.message || 'Failed to update device. Please try again.';
      toast({
        variant: 'destructive',
        title: 'Update Error',
        description: message,
      });
    },
  });
}

export function useToggleDeviceStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      deviceService.toggleDeviceStatus(id, isActive),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: DEVICES_QUERY_KEY });
      toast({
        variant: 'success',
        title: variables.isActive ? 'Device Activated' : 'Device Deactivated',
        description: variables.isActive
          ? 'Device has been activated successfully.'
          : 'Device has been deactivated successfully.',
      });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.message || 'Failed to update device status. Please try again.';
      toast({
        variant: 'destructive',
        title: 'Status Update Error',
        description: message,
      });
    },
  });
}

export function useDeviceConfiguration(deviceId: number | null) {
  return useQuery({
    queryKey: ['deviceConfiguration', deviceId],
    queryFn: () => deviceService.getDeviceConfiguration(deviceId!),
    enabled: deviceId !== null,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateDeviceConfiguration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ configId, ...data }: UpdateDeviceConfigurationRequest & { configId: number }) =>
      deviceService.updateDeviceConfiguration(configId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deviceConfiguration'] });
      toast({
        variant: 'success',
        title: 'Configuration Updated',
        description: 'Device configuration has been updated successfully.',
      });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.message || 'Failed to update configuration. Please try again.';
      toast({
        variant: 'destructive',
        title: 'Update Error',
        description: message,
      });
    },
  });
}

// Configuration Enum Hooks
export function useApplicationPermissionGranters() {
  return useQuery({
    queryKey: ['configEnums', 'applicationPermissionGranters'],
    queryFn: deviceService.getApplicationPermissionGranters,
    staleTime: 30 * 60 * 1000, // 30 minutes - enums rarely change
  });
}

export function useFeatureStates() {
  return useQuery({
    queryKey: ['configEnums', 'featureStates'],
    queryFn: deviceService.getFeatureStates,
    staleTime: 30 * 60 * 1000,
  });
}

export function useLocationTrackingTypes() {
  return useQuery({
    queryKey: ['configEnums', 'locationTrackingTypes'],
    queryFn: deviceService.getLocationTrackingTypes,
    staleTime: 30 * 60 * 1000,
  });
}

export function usePushNotificationProtocols() {
  return useQuery({
    queryKey: ['configEnums', 'pushNotificationProtocols'],
    queryFn: deviceService.getPushNotificationProtocols,
    staleTime: 30 * 60 * 1000,
  });
}
