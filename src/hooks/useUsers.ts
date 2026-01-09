import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userService } from '@/api/services/user.service';
import { toast } from '@/hooks/useToast';
import type { CreateManagerRequest, UpdateManagerRequest } from '@/types/user.types';

const USERS_QUERY_KEY = ['users'];

export function useUsersQuery() {
  return useQuery({
    queryKey: USERS_QUERY_KEY,
    queryFn: userService.getAllManagers,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateManagerRequest) => userService.createManager(data),
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
    mutationFn: ({ id, ...data }: UpdateManagerRequest) => userService.updateUser(id, data),
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
    mutationFn: (id: number) => userService.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
      toast({
        variant: 'success',
        title: 'User Deleted',
        description: 'User has been deleted successfully.',
      });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.message || 'Failed to delete user. Please try again.';
      toast({
        variant: 'destructive',
        title: 'Delete Error',
        description: message,
      });
    },
  });
}
