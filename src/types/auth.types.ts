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
  password: string;
  phone: string;
  active: boolean;
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
