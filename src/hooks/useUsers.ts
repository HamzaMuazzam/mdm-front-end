import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userService } from '@/api/services/user.service';
import { toast } from '@/hooks/useToast';
import { useAuthStore } from '@/store/authStore';
import type { UpdateUserRequest, ResetUserPasswordRequest } from '@/types/user.types';
import type { RegisterRequest } from '@/types/auth.types';

const USERS_QUERY_KEY = ['users'];

export function useUsersQuery() {
  const token = useAuthStore((state) => state.token);
  return useQuery({
    queryKey: USERS_QUERY_KEY,
    queryFn: () => userService.getAll(),
    staleTime: 5 * 60 * 1000,
    retry: false,
    enabled: !!token,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RegisterRequest) => userService.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
      toast({
        variant: 'success',
        title: 'User Created',
        description: 'User has been created successfully.',
      });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.message || 'Failed to create user. Please try again.';
      toast({
        variant: 'destructive',
        title: 'Create Error',
        description: message,
      });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateUserRequest) => userService.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
      toast({
        variant: 'success',
        title: 'User Updated',
        description: 'User has been updated successfully.',
      });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.message || 'Failed to update user. Please try again.';
      toast({
        variant: 'destructive',
        title: 'Update Error',
        description: message,
      });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: boolean }) =>
      userService.deleteUser(id, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
      const isActivating = variables.status;
      toast({
        variant: 'success',
        title: isActivating ? 'User Activated' : 'User Deleted',
        description: isActivating
          ? 'User has been activated successfully.'
          : 'User has been deleted successfully.',
      });
    },
    onError: (error: any, variables) => {
      const isActivating = variables.status;
      const message =
        error?.response?.data?.message ||
        error?.message ||
        `Failed to ${isActivating ? 'activate' : 'delete'} user.`;
      toast({
        variant: 'destructive',
        title: isActivating ? 'Activate Error' : 'Delete Error',
        description: message,
      });
    },
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: (data: ResetUserPasswordRequest) => userService.resetUserPassword(data),
    onSuccess: () => {
      toast({
        variant: 'success',
        title: 'Password Reset',
        description: 'User password has been reset successfully.',
      });
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to reset user password. Please try again.';
      toast({
        variant: 'destructive',
        title: 'Reset Error',
        description: message,
      });
    },
  });
}
