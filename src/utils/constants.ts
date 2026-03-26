
//TODO: for live server only
// export const WS = 'wss';
// export const API_BASE_URL = 'https://mdm.dspl.pk/api';
// export const MQTT_BROKER_URL = `wss://mdm.dspl.pk:8084/mqtt`;


//TODO: for local development
export const WS = 'ws';
export const API_BASE_URL = 'http://192.168.100.3:9000/apis';
export const MQTT_BROKER_URL = `ws://192.168.100.3:8083/mqtt`;


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
} as const;

export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Server not reachable. Please try again later.',
  LOGIN_FAILED: 'Invalid credentials. Please check your email and password.',
  REGISTRATION_FAILED: 'Registration failed. Please try again.',
  OTP_INVALID: 'Invalid OTP. Please check and try again.',
  REQUIRED_FIELD: 'This field is required',
} as const;
