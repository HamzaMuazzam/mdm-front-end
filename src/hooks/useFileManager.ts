import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fileManagerService } from '@/api/services/file-manager.service';
import { toast } from '@/hooks/useToast';
import type { SendFileCommandRequest, FileCommandStatus } from '@/types/file-manager.types';

const COMMANDS_KEY = (deviceUuid: string) => ['fileManagerCommands', deviceUuid];
const EVENTS_KEY   = (deviceUuid: string) => ['fileEvents', deviceUuid];

/** Send any file command and invalidate the command list on success. */
export function useSendFileCommand(deviceUuid: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SendFileCommandRequest) => fileManagerService.sendCommand(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: COMMANDS_KEY(deviceUuid) });
      const cmd = res.data;
      if (cmd.status === 'FAILED') {
        toast({
          variant: 'destructive',
          title: 'Command Failed',
          description: cmd.errorMessage ?? 'MQTT publish rejected',
        });
      } else {
        toast({
          variant: 'success',
          title: 'Command Sent',
          description: `${cmd.commandType} dispatched to device`,
        });
      }
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message ?? error?.message ?? 'Failed to send command';
      toast({ variant: 'destructive', title: 'Error', description: message });
    },
  });
}

/**
 * Poll a single command by ID until status is terminal (COMPLETED | FAILED).
 * Stops polling after 60 seconds to avoid infinite requests.
 */
export function usePollCommand(
  commandId: number | null,
  enabled = true
) {
  return useQuery({
    queryKey: ['fileCommand', commandId],
    queryFn: () => fileManagerService.getCommand(commandId!),
    enabled: enabled && commandId !== null,
    refetchInterval: (data) => {
      const status: FileCommandStatus | undefined = data?.data?.status;
      if (status === 'COMPLETED' || status === 'FAILED') return false;
      return 2000; // poll every 2 s
    },
    staleTime: 0,
  });
}

export function useFileCommandsByDevice(deviceUuid: string, page = 0, size = 20) {
  return useQuery({
    queryKey: [...COMMANDS_KEY(deviceUuid), page, size],
    queryFn: () => fileManagerService.listCommandsByDevice(deviceUuid, page, size),
    enabled: !!deviceUuid,
    staleTime: 30_000,
  });
}

export function useFileEventsByDevice(deviceUuid: string, page = 0, size = 50) {
  return useQuery({
    queryKey: [...EVENTS_KEY(deviceUuid), page, size],
    queryFn: () => fileManagerService.listEventsByDevice(deviceUuid, page, size),
    enabled: !!deviceUuid,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}
