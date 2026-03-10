import { z } from 'zod';

// Email validation regex
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Validation schemas for forms
export const loginSchema = z.object({
  login: z.string().min(1, 'Email is required').email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email format'),
  userName: z.string().max(100, 'Username cannot exceed 100 characters').optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z
    .string()
    .regex(/^\+?[0-9]{10,15}$/, 'Phone must be 10-15 digits, optionally starting with +')
    .optional()
    .or(z.literal('')),
});

export const otpSchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email format'),
  otp: z.string().optional(),
  password: z.string().optional(),
});

export const userSchema = z.object({
  email: z.string().email('Invalid email format'),
  userName: z.string().min(1, 'User name is required'),
  phone: z.string().min(10).max(15).regex(/^\d+$/, 'Invalid phone number'),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  active: z.boolean().default(true),
});

export const deviceSchema = z.object({
  deviceUuid: z.string().min(1, 'Device UUID is required'),
  phone: z.string().min(10).max(15),
  userEmail: z.string().email('Invalid email format'),
  model: z.string().min(1, 'Model is required'),
  osVersion: z.string().min(1, 'OS Version is required'),
  description: z.string().optional(),
});

export const updateDeviceSchema = z.object({
  description: z.string().optional(),
  phone: z.string().min(10).max(15).optional(),
  cpuArchitecture: z.string().optional(),
  isDeviceAdmin: z.boolean().optional(),
  canOverlayWindows: z.boolean().optional(),
  canAccessUsageHistory: z.boolean().optional(),
  canAccessAccessibility: z.boolean().optional(),
  model: z.string().optional(),
  osVersion: z.string().optional(),
  batteryCharge: z.number().optional(),
  launcherVariant: z.string().optional(),
  defaultLauncher: z.string().optional(),
});

// Validation functions
export function validateEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

export function validatePhone(phone: string): boolean {
  return /^\d{10,15}$/.test(phone);
}
