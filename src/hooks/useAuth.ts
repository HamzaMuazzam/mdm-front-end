import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/api/services/auth.service';
import { subscriptionService } from '@/api/services/subscription.service';
import { useAuthStore } from '@/store/authStore';
import { ROUTES, isAdminRole } from '@/utils/constants';
import { toast } from '@/hooks/useToast';
import { queryClient } from '@/main';
import type {
  RegisterRequest,
  EmailVerificationRequest,
  UpdatePasswordRequest,
} from '@/types/auth.types';

export function useLogin() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  return useMutation({
    mutationFn: authService.login,
    onSuccess: async (data) => {
      // Handle error code 0007 (unverified email) — API returns 200 with errorCode
      if (data.errorCode === '0007') {
        localStorage.setItem('pendingEmail', data.data?.email || '');
        navigate(ROUTES.VERIFY_OTP);
        return;
      }

      if (data.success && data.data.token) {
        const { token, ...user } = data.data;
        setAuth(token, user);

        // Clear React Query cache from previous session
        queryClient.clear();

        // Admins (Admin / Super Admin) skip the subscription check
        if (!isAdminRole(user.roleName)) {
          const userPlan = await subscriptionService.getUserPlan();
          if (!userPlan) {
            const plans = await subscriptionService.getSubscriptionPlans();
            localStorage.setItem('subscriptionPlans', JSON.stringify(plans));
            window.location.href = ROUTES.SUBSCRIPTIONS;
            return;
          }
        }

        // Force page reload to ensure fresh data
        window.location.href = ROUTES.DASHBOARD;
      }
    },
    onError: (error: any, variables) => {
      const message = error?.response?.data?.message || error?.message || 'Login failed. Please try again.';
      const errorCode = error?.response?.data?.errorCode;

      // Handle unverified email — API returns HTTP error with message or errorCode 0007
      if (errorCode === '0007' || message === 'Email not verified') {
        localStorage.setItem('pendingEmail', variables.login);
        navigate(ROUTES.VERIFY_OTP);
        return;
      }

      toast({
        variant: 'destructive',
        title: 'Login Error',
        description: message,
      });
    },
  });
}

export function useRegister() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: RegisterRequest) => authService.register(data),
    onSuccess: (_, variables) => {
      localStorage.setItem('pendingEmail', variables.email);
      navigate(ROUTES.VERIFY_OTP);
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.message || 'Registration failed. Please try again.';
      toast({
        variant: 'destructive',
        title: 'Registration Error',
        description: message,
      });
    },
  });
}

export function useVerifyOtp() {
  const setAuth = useAuthStore((state) => state.setAuth);

  return useMutation({
    mutationFn: authService.verifyOtp,
    onSuccess: async (data) => {
      if (data.success && data.data) {
        const { token, ...user } = data.data;
        setAuth(token, user);

        // Clear React Query cache from previous session
        queryClient.clear();

        window.location.href = ROUTES.DASHBOARD;
      }
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.message || 'OTP verification failed. Please try again.';
      toast({
        variant: 'destructive',
        title: 'Verification Error',
        description: message,
      });
    },
  });
}

export function useSendOtp() {
  return useMutation({
    mutationFn: (data: EmailVerificationRequest) => authService.sendEmailVerification(data),
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.message || 'Failed to send OTP. Please try again.';
      toast({
        variant: 'destructive',
        title: 'OTP Error',
        description: message,
      });
    },
  });
}

export function useUpdatePassword() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: UpdatePasswordRequest) => authService.updatePassword(data),
    onSuccess: () => {
      toast({
        variant: 'success',
        title: 'Password Updated',
        description: 'Your password has been updated successfully.',
      });
      setTimeout(() => navigate(ROUTES.LOGIN), 1500);
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.message || 'Failed to update password. Please try again.';
      toast({
        variant: 'destructive',
        title: 'Update Error',
        description: message,
      });
    },
  });
}

export function useLogout() {
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  return () => {
    // Clear auth state and localStorage
    logout();

    // Clear React Query cache to remove all cached data
    queryClient.clear();

    // Navigate to login
    navigate(ROUTES.LOGIN);
  };
}
