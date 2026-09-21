import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { appControlService } from '@/api/services/appControl.service';
import type { AppControlAction, AppControlRequest, AppControlStatus } from '@/types/appControl.types';

export const APP_CONTROL_QUERY_KEY = ['appControl'];

/** While anything is still waiting for a device, poll; stop as soon as the batch is settled. */
const LIVE_POLL_MS = 3000;

export function useAppControlPreview() {
  return useMutation({ mutationFn: (req: AppControlRequest) => appControlService.preview(req) });
}

export function useAppControlExecute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: AppControlRequest) => appControlService.execute(req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: APP_CONTROL_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['bulkOperations'] });
    },
  });
}

export function useAppControlRetry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (batchId: number) => appControlService.retry(batchId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: APP_CONTROL_QUERY_KEY }),
  });
}

export function useAppControlBatches(params: { page: number; size: number; action?: AppControlAction }, enabled = true) {
  return useQuery({
    queryKey: [...APP_CONTROL_QUERY_KEY, 'batches', params],
    queryFn: () => appControlService.listBatches(params),
    enabled,
    placeholderData: (prev) => prev,
    refetchInterval: (query) => (query.state.data?.content.some((b) => b.openCount > 0) ? 10000 : false),
  });
}

export function useAppControlBatch(batchId: number | null, live = true) {
  return useQuery({
    queryKey: [...APP_CONTROL_QUERY_KEY, 'batch', batchId],
    queryFn: () => appControlService.getBatch(batchId!),
    enabled: batchId != null,
    refetchInterval: (query) => (live && (query.state.data?.openCount ?? 1) > 0 ? LIVE_POLL_MS : false),
  });
}

export function useAppControlBatchCommands(
  batchId: number | null,
  params: { page: number; size: number; status?: AppControlStatus[] },
  /** Keep refreshing while the batch still has open commands. */
  live: boolean
) {
  return useQuery({
    queryKey: [...APP_CONTROL_QUERY_KEY, 'batchCommands', batchId, params],
    queryFn: () => appControlService.listBatchCommands(batchId!, params),
    enabled: batchId != null,
    placeholderData: (prev) => prev,
    refetchInterval: live ? LIVE_POLL_MS : false,
  });
}
