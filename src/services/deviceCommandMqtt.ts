import { mqttService } from '@/api/services/mqtt.service';

export type DeviceCommandType = 'reboot' | 'reset';

interface SendDeviceCommandOptions {
  deviceUuid: string;
  command: DeviceCommandType;
  extraPayload?: Record<string, unknown>;
}

interface DeviceCommandEnvelope {
  command: DeviceCommandType;
  deviceUuid: string;
  requestedAt: string;
  requestedBy?: string;
}

export interface BackendMqttCommandRequest {
  command: string;
  payload: string;
}

const COMMAND_TOPIC_SUFFIX: Record<DeviceCommandType, string> = {
  reboot: 'reboot',
  reset: 'reset',
};

function getCurrentUserEmail(): string | undefined {
  try {
    const userStr = localStorage.getItem('user');
    if (!userStr) return undefined;
    const user = JSON.parse(userStr);
    return typeof user?.email === 'string' ? user.email : undefined;
  } catch {
    return undefined;
  }
}

export function buildDeviceCommandTopic(deviceUuid: string, command: DeviceCommandType): string {
  return `device/${deviceUuid}/${COMMAND_TOPIC_SUFFIX[command]}`;
}

export async function sendBackendMqttCommand(request: BackendMqttCommandRequest): Promise<unknown> {
  return mqttService.sendClientCommand(request);
}

export async function sendDeviceCommandViaApi({
  deviceUuid,
  command,
  extraPayload,
}: SendDeviceCommandOptions): Promise<{ command: string; payload: string }> {
  const topic = buildDeviceCommandTopic(deviceUuid, command);
  const requestedBy = getCurrentUserEmail();
  const payloadEnvelope: DeviceCommandEnvelope & Record<string, unknown> = {
    command,
    deviceUuid,
    requestedAt: new Date().toISOString(),
    ...(requestedBy ? { requestedBy } : {}),
    ...(extraPayload ?? {}),
  };
  const payload = JSON.stringify(payloadEnvelope);

  await sendBackendMqttCommand({
    command: topic,
    payload,
  });

  return { command: topic, payload };
}

export const sendDeviceCommandViaMqtt = sendDeviceCommandViaApi;
