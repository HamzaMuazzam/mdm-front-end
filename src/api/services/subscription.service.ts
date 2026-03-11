import { apiClient } from '../client';
import type {
  Subscription,
  UserSubscriptionPlan,
  UserPlanSubscription,
  AssignPlanRequest,
  CreateSubscriptionRequest,
} from '@/types/subscription.types';
import type { ApiResponse, PaginatedResponse } from '@/types/api.types';

export const subscriptionService = {
  async getSubscriptionPlans(
    page = 0,
    size = 100,
    sort = 'subscriptionName,asc',
    includeCustomPlan = false
  ): Promise<Subscription[]> {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<Subscription>>>(
      `/v1/subscriptions?page=${page}&size=${size}&sort=${sort}&includeCustomPlan=${includeCustomPlan}`
    );
    return response.data.data.content;
  },

  async getUserPlan(): Promise<UserSubscriptionPlan | null> {
    try {
      const response = await apiClient.get<ApiResponse<UserSubscriptionPlan>>(
        '/v1/user-subscription-plans/user/plan'
      );
      return response.data.data;
    } catch (error: any) {
      if (error.response) {
        // Server responded (e.g. 404 = no active plan) — treat as no plan
        return null;
      }
      // Network error (server down) — propagate so ProtectedRoute can distinguish
      throw error;
    }
  },

  async assignPlan(data: AssignPlanRequest): Promise<ApiResponse<UserSubscriptionPlan>> {
    const response = await apiClient.post<ApiResponse<UserSubscriptionPlan>>(
      '/v1/user-subscription-plans/assign',
      data
    );
    return response.data;
  },

  async getUserPlans(): Promise<UserPlanSubscription[]> {
    const response = await apiClient.get<ApiResponse<UserPlanSubscription[]>>(
      '/v1/subscriptions/user-plans'
    );
    return response.data.data;
  },

  async createPlan(data: CreateSubscriptionRequest): Promise<ApiResponse<Subscription>> {
    const response = await apiClient.post<ApiResponse<Subscription>>('/v1/subscriptions', data);
    return response.data;
  },
};
