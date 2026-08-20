import { apiClient } from '../client';
import type { ApiResponse } from '@/types/api.types';
import type { BulkOperationLog, BulkOperationLogQuery, SpringPage } from '@/types/bulk.types';

/** Account-scoped history of bulk operations and device-group changes. */
export const bulkOperationsService = {
  async list(query: BulkOperationLogQuery = {}): Promise<SpringPage<BulkOperationLog>> {
    const res = await apiClient.get<ApiResponse<SpringPage<BulkOperationLog>>>('/v1/bulk-operations', {
      params: {
        page: query.page ?? 0,
        size: query.size ?? 20,
        module: query.module || undefined,
        from: query.from || undefined,
        to: query.to || undefined,
      },
    });
    return res.data.data;
  },
};
