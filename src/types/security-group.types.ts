export interface SecurityGroup {
  id: number;
  groupName: string;
  description: string;
  parentGroupId?: number | null;
  parentGroupName?: string | null;
  createdByUserEmail?: string | null;
  /** Users currently assigned to this group (within the caller's visibility). */
  userCount?: number;
}

export interface MoveSecurityGroupUsersRequest {
  userIds: number[];
  /** null = remove the users from any security group */
  targetSecurityGroupId: number | null;
}

export interface MoveSecurityGroupUsersResponse {
  moved: number;
  skipped: { userId: number; reason: string }[];
}

export interface CreateSecurityGroupRequest {
  groupName: string;
  description: string;
}

export interface PermissionItem {
  permissionId: number;
  permissionName: string;
  description: string;
  isAllocated: boolean;
  isAllowed: boolean;
}

export interface PermissionGroup {
  permissionGroupId: number;
  permissionGroupName: string;
  permissions: PermissionItem[];
}

export interface SecurityGroupPermissionMatrix {
  securityGroupId: number;
  securityGroupName: string;
  permissionGroups: PermissionGroup[];
}
