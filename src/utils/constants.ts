
// MQTT broker URL (WebSocket) — adjust port if your broker uses a different WS port
// http://10.10.10.32:9000/swagger-ui/index.html
// export const API_BASE_URL = 'http://10.10.10.32:9000';
// export const MQTT_BROKER_URL = 'wss://10.10.10.32:8084/mqtt';
// export const MQTT_BROKER_URL = 'ws://10.10.10.32:8083/mqtt';

export const API_BASE_URL = 'http://10.10.10.81:9000';
export const MQTT_BROKER_URL = 'ws://10.10.10.81:8083/mqtt';

// export const API_BASE_URL = 'http://192.168.100.38:9000';
// export const MQTT_BROKER_URL = 'ws://192.168.100.38:8083/mqtt';


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

export const USER_LEVELS = {
  L1: 'L1',
  L2: 'L2',
} as const;

export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Server not reachable. Please try again later.',
  LOGIN_FAILED: 'Invalid credentials. Please check your email and password.',
  REGISTRATION_FAILED: 'Registration failed. Please try again.',
  OTP_INVALID: 'Invalid OTP. Please check and try again.',
  REQUIRED_FIELD: 'This field is required',
} as const;
