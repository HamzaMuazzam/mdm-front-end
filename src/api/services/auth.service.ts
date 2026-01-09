import { apiClient } from '../client';
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  OtpRequest,
  EmailVerificationRequest,
  UpdatePasswordRequest,
} from '@/types/auth.types';
import type { ApiResponse } from '@/types/api.types';

export const authService = {
  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>('/v1/users/login', data);
    return response.data;
  },

  async register(data: RegisterRequest): Promise<ApiResponse<any>> {
    const response = await apiClient.post<ApiResponse<any>>('/v1/users', data);
    return response.data;
  },

  async verifyOtp(data: OtpRequest): Promise<ApiResponse<any>> {
    const response = await apiClient.post<ApiResponse<any>>('/v1/users/verify_otp', data);
    return response.data;
  },

  async sendEmailVerification(data: EmailVerificationRequest): Promise<ApiResponse<any>> {
    const response = await apiClient.post<ApiResponse<any>>('/v1/users/email_verification', data);
    return response.data;
  },

  async updatePassword(data: UpdatePasswordRequest): Promise<ApiResponse<any>> {
    const response = await apiClient.post<ApiResponse<any>>('/v1/users/update_password', data);
    return response.data;
  },
};
