import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { subscriptionService } from '@/api/services/subscription.service';
import { toast } from '@/hooks/useToast';
import { ROUTES } from '@/utils/constants';
import { useAuthStore } from '@/store/authStore';
import type { AssignPlanRequest, CreateSubscriptionRequest } from '@/types/subscription.types';

const SUBSCRIPTIONS_QUERY_KEY = ['subscriptions'];
const USER_PLAN_QUERY_KEY = ['userPlan'];
const USER_PLANS_QUERY_KEY = ['userPlans'];

export function useSubscriptionPlansQuery() {
  return useQuery({
    queryKey: SUBSCRIPTIONS_QUERY_KEY,
    queryFn: () => subscriptionService.getSubscriptionPlans(),
    staleTime: 10 * 60 * 1000,
  });
}

// Fetches all plans including custom ones — used in admin dropdowns
export function useAllPlansQuery() {
  return useQuery({
    queryKey: [...SUBSCRIPTIONS_QUERY_KEY, 'includeCustom'],
    queryFn: () => subscriptionService.getSubscriptionPlans(0, 100, 'subscriptionName,asc', true),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUserPlanQuery() {
  return useQuery({
    queryKey: USER_PLAN_QUERY_KEY,
    queryFn: () => subscriptionService.getUserPlan(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useUserPlansQuery() {
  return useQuery({
    queryKey: USER_PLANS_QUERY_KEY,
    queryFn: () => subscriptionService.getUserPlans(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useAssignPlan() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const logout = useAuthStore((state) => state.logout);

  return useMutation({
    mutationFn: (data: AssignPlanRequest) => subscriptionService.assignPlan(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_PLAN_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: USER_PLANS_QUERY_KEY });
      toast({
        variant: 'success',
        title: 'Plan Assigned',
        description: 'Subscription plan has been assigned successfully. Please login to continue.',
      });
      logout();
      navigate(ROUTES.LOGIN);
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

export function useCreateSubscriptionPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSubscriptionRequest) => subscriptionService.createPlan(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: USER_PLANS_QUERY_KEY });
      toast({
        variant: 'success',
        title: 'Plan Created',
        description: 'Subscription plan has been created successfully.',
      });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.message || 'Failed to create plan.';
      toast({
        variant: 'destructive',
        title: 'Create Error',
        description: message,
      });
    },
  });
}

export function useChangePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AssignPlanRequest) => subscriptionService.assignPlan(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_PLAN_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: USER_PLANS_QUERY_KEY });
      toast({
        variant: 'success',
        title: 'Plan Changed',
        description: 'Your subscription plan has been changed successfully.',
      });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.message || 'Failed to change plan. Please try again.';
      toast({
        variant: 'destructive',
        title: 'Plan Change Error',
        description: message,
      });
    },
  });
}
