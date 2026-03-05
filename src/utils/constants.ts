
//TODO: for live server only
// export const WS = 'wss';
// export const API_BASE_URL = 'https://mdm.dspl.pk/api';
// export const MQTT_BROKER_URL = `${WS}://mdm.dspl.pk:8084/mqtt`;


//TODO: for local development
export const WS = 'ws';
export const API_BASE_URL = 'http://10.10.10.81:9000/api';
export const MQTT_BROKER_URL = `${WS}://10.10.10.81:8083/mqtt`;



export const ROUTES = {
  LOGIN: '/login',
  REGISTER: '/register',
  VERIFY_OTP: '/verify-otp',
  FORGOT_PASSWORD: '/forgot-password',
  SUBSCRIPTIONS: '/subscriptions',
  DASHBOARD: '/dashboard',
  DEVICE_APPLICATIONS: '/device/:deviceId/applications',
  DEVICE_REQUESTS: '/device/:deviceId/requests',
  DEVICE_MONITOR: '/device/:deviceId/monitor',
} as const;

export const ADMIN_ROLES = ['admin', 'superadmin'] as const;

/** Returns true when the role name is Admin or Super Admin (case-insensitive). */
export function isAdminRole(roleName?: string): boolean {
  if (!roleName) return false;
  const normalized = roleName.toLowerCase().replace(/[\s_-]/g, '');
  return ADMIN_ROLES.some((r) => normalized === r);
}

export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Server not reachable. Please try again later.',
  LOGIN_FAILED: 'Invalid credentials. Please check your email and password.',
  REGISTRATION_FAILED: 'Registration failed. Please try again.',
  OTP_INVALID: 'Invalid OTP. Please check and try again.',
  REQUIRED_FIELD: 'This field is required',
} as const;
