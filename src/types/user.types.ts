export interface UpdateUserRequest {
  id: number;
  userName?: string;
  email?: string;
  phone?: string;
  profileImg?: string;
  active?: boolean;
}

export interface ResetUserPasswordRequest {
  email: string;
  password: string;
}
