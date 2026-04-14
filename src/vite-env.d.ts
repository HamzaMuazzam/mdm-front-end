/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_MQTT_BROKER_URL: string;
  readonly VITE_WS_PROTOCOL: string;
  readonly VITE_SERVER_HOST: string;
  readonly VITE_SERVER_ORIGIN: string;
  // Firebase
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_FIREBASE_VAPID_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
