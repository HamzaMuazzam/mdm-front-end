export interface User {
  id: number;
  email: string;
  login: string;
  userName?: string;
  phone?: string;
  active: boolean;
}

export interface LoginRequest {
  login: string;
  password: string;
  fcmToken?: string;
}

export interface LoginResponse {
  success: boolean;
  data: {
    token: string;
  } & User;
  message?: string;
  errorCode?: string;
}

export interface RegisterRequest {
  login: string;
  email: string;
  userName?: string;
  password: string;
  phone?: string;
  profileImg?: string;
  parentId?: number | null;
  copyConfiguration: boolean;
  active: boolean;
  securityGroupId?: number | null;
  planId?: number | null;
}

export interface OtpRequest {
  email: string;
  otp: string;
}

export interface EmailVerificationRequest {
  email: string;
}

export interface UpdatePasswordRequest {
  email: string;
  otp: string;
  password: string;
}
