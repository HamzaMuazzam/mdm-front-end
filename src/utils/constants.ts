
// Variant-driven config — set by .env.development (local) or .env.production (server)
// To switch variants, use the npm scripts: dev / dev:server / build / build:local
export const WS = import.meta.env.VITE_WS_PROTOCOL as string;
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;
export const MQTT_BROKER_URL = import.meta.env.VITE_MQTT_BROKER_URL as string;


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
  DEVICE_NOTIFICATIONS: '/device/:deviceId/notifications',
  DEVICE_ALERT: '/device/:deviceId/alert',
  DEVICE_AUDIO: '/device/:deviceId/audio',
  DEVICE_DATA:     '/device/:deviceId/data',
  DEVICE_TRACKING: '/device/:deviceId/tracking',
  ALL_DEVICES_MAP: '/devices/track-all',
  DEVICE_SOS: '/device/:deviceId/sos',
  DEVICE_TIME_RANGE: '/device/:deviceId/time-range',
  DEVICE_SIM_CHANGES: '/device/:deviceId/sim-changes',
  DEVICE_INTEGRITY: '/device/:deviceId/integrity',
  DEVICE_SSL_PINNING: '/device/:deviceId/ssl-pinning',
} as const;

export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Server not reachable. Please try again later.',
  LOGIN_FAILED: 'Invalid credentials. Please check your email and password.',
  REGISTRATION_FAILED: 'Registration failed. Please try again.',
  OTP_INVALID: 'Invalid OTP. Please check and try again.',
  REQUIRED_FIELD: 'This field is required',
} as const;
