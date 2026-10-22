export interface UpdateUserRequest {
  id: number;
  userName?: string;
  email?: string;
  phone?: string;
  profileImg?: string;
  active?: boolean;
  /** When set, moves the user to this security group. */
  securityGroupId?: number;
}

export interface ResetUserPasswordRequest {
  email: string;
  password: string;
}
