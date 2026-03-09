import { create } from 'zustand';
import type { SecurityGroupPermissionMatrix } from '@/types/security-group.types';

interface PermissionState {
  allocatedPermissions: Set<string>;
  isLoaded: boolean;
  setPermissions: (matrix: SecurityGroupPermissionMatrix) => void;
  clearPermissions: () => void;
  hasPermission: (name: string) => boolean;
}

export const usePermissionStore = create<PermissionState>((set, get) => ({
  allocatedPermissions: new Set(),
  isLoaded: false,

  setPermissions: (matrix) => {
    const permissions = new Set<string>();
    matrix.permissionGroups.forEach((group) => {
      group.permissions.forEach((perm) => {
        if (perm.isAllocated) {
          permissions.add(perm.permissionName);
        }
      });
    });
    set({ allocatedPermissions: permissions, isLoaded: true });
  },

  clearPermissions: () => set({ allocatedPermissions: new Set(), isLoaded: false }),

  /** Returns true when the permission is explicitly allocated. Falls open (true) while not yet loaded. */
  hasPermission: (name) => {
    const state = get();
    if (!state.isLoaded) return true;
    return state.allocatedPermissions.has(name);
  },
}));
