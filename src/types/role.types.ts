export interface Role {
  id: number;
  roleName: string;
  description: string;
  securityGroupId: number;
  securityGroupName: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoleRequest {
  roleName: string;
  description: string;
  securityGroupId: number;
}
