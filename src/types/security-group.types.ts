export interface SecurityGroup {
  id: number;
  groupName: string;
  description: string;
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
