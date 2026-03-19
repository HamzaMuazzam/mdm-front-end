import axios from 'axios';
import {API_BASE_URL} from "@/utils/constants.ts";
import { useAuthStore } from '@/store/authStore';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

// Request interceptor: Add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Handle 401 errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token is missing or expired/invalid — logout so the user can re-authenticate.
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);
