import axios, { type AxiosError } from 'axios';
import { API_BASE_URL } from '@/utils/constants';

export interface MqttClientPresence {
  clientId?: string | null;
  deviceId?: string | null;
  status?: string | null;
}

export interface MqttClientCommandRequest {
  command: string;
  payload: string;
}

const mqttHttp = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    accept: '*/*',
  },
});

mqttHttp.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const MQTT_CLIENTS_ENDPOINTS = ['/api/mqtt/clients'];
const MQTT_COMMAND_ENDPOINTS = ['/api/mqtt/clients/command'];

function canRetryOnAltEndpoint(error: unknown): boolean {
  const status = (error as AxiosError)?.response?.status;
  return status === 401 || status === 404 || status === 405;
}

async function getWithEndpointFallback<T>(endpoints: string[]): Promise<T> {
  let lastError: unknown;

  for (let index = 0; index < endpoints.length; index += 1) {
    const endpoint = endpoints[index];
    try {
      const response = await mqttHttp.get<T>(endpoint);
      return response.data;
    } catch (error) {
      lastError = error;
      const hasNext = index < endpoints.length - 1;
      if (!hasNext || !canRetryOnAltEndpoint(error)) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error('Unable to fetch MQTT clients.');
}

async function postWithEndpointFallback<T>(endpoints: string[], body: unknown): Promise<T> {
  let lastError: unknown;

  for (let index = 0; index < endpoints.length; index += 1) {
    const endpoint = endpoints[index];
    try {
      const response = await mqttHttp.post<T>(endpoint, body);
      return response.data;
    } catch (error) {
      lastError = error;
      const hasNext = index < endpoints.length - 1;
      if (!hasNext || !canRetryOnAltEndpoint(error)) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error('Unable to publish MQTT command.');
}

export const mqttService = {
  getClients(): Promise<MqttClientPresence[]> {
    return getWithEndpointFallback<MqttClientPresence[]>(MQTT_CLIENTS_ENDPOINTS);
  },

  sendClientCommand(request: MqttClientCommandRequest): Promise<unknown> {
    return postWithEndpointFallback<unknown>(MQTT_COMMAND_ENDPOINTS, request);
  },
};
