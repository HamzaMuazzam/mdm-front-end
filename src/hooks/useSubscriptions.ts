import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { subscriptionService } from '@/api/services/subscription.service';
import { toast } from '@/hooks/useToast';
import { ROUTES } from '@/utils/constants';
import type { AssignPlanRequest } from '@/types/subscription.types';

const SUBSCRIPTIONS_QUERY_KEY = ['subscriptions'];
const USER_PLAN_QUERY_KEY = ['userPlan'];

export function useSubscriptionPlansQuery() {
  return useQuery({
    queryKey: SUBSCRIPTIONS_QUERY_KEY,
    queryFn: () => subscriptionService.getSubscriptionPlans(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useUserPlanQuery() {
  return useQuery({
    queryKey: USER_PLAN_QUERY_KEY,
    queryFn: () => subscriptionService.getUserPlan(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useAssignPlan() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AssignPlanRequest) => subscriptionService.assignPlan(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_PLAN_QUERY_KEY });
      toast({
        variant: 'success',
        title: 'Plan Assigned',
        description: 'Subscription plan has been assigned successfully.',
      });
      navigate(ROUTES.DASHBOARD);
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.message || 'Failed to assign plan. Please try again.';
      toast({
        variant: 'destructive',
        title: 'Assignment Error',
        description: message,
      });
    },
  });
}
