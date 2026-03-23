import { contextBridge, ipcRenderer } from 'electron';

// Whitelist of allowed IPC channels
const SEND_CHANNELS = [
  'recording:start',
  'recording:stop',
] as const;

const RECEIVE_CHANNELS = [
  'recording:status-update',
  'monitoring:status-update',
  'backend:error',
] as const;

const INVOKE_CHANNELS = [
  'recording:start',
  'recording:stop',
  'recording:status',
  'window:open-library',
  'window:open-settings',
  'app:get-backend-url',
  'app:set-login-item',
  'app:get-login-item',
] as const;

type SendChannel = typeof SEND_CHANNELS[number];
type ReceiveChannel = typeof RECEIVE_CHANNELS[number];
type InvokeChannel = typeof INVOKE_CHANNELS[number];

contextBridge.exposeInMainWorld('api', {
  send: (channel: SendChannel, data?: unknown) => {
    if ((SEND_CHANNELS as readonly string[]).includes(channel)) {
      ipcRenderer.send(channel, data);
    } else {
      console.warn(`[Preload] Blocked send on unauthorized channel: ${channel}`);
    }
  },

  on: (channel: ReceiveChannel, callback: (...args: unknown[]) => void) => {
    if ((RECEIVE_CHANNELS as readonly string[]).includes(channel)) {
      const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args);
      ipcRenderer.on(channel, subscription);

      // Return unsubscribe function
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    } else {
      console.warn(`[Preload] Blocked listener on unauthorized channel: ${channel}`);
      return () => {};
    }
  },

  invoke: (channel: InvokeChannel, data?: unknown): Promise<unknown> => {
    if ((INVOKE_CHANNELS as readonly string[]).includes(channel)) {
      return ipcRenderer.invoke(channel, data);
    } else {
      console.warn(`[Preload] Blocked invoke on unauthorized channel: ${channel}`);
      return Promise.reject(new Error(`Unauthorized channel: ${channel}`));
    }
  },

  getBackendUrl: (): Promise<string> => {
    return ipcRenderer.invoke('app:get-backend-url') as Promise<string>;
  },

  platform: process.platform,
});

// Type declaration for the renderer process
export interface ElectronAPI {
  send: (channel: SendChannel, data?: unknown) => void;
  on: (channel: ReceiveChannel, callback: (...args: unknown[]) => void) => () => void;
  invoke: (channel: InvokeChannel, data?: unknown) => Promise<unknown>;
  getBackendUrl: () => Promise<string>;
  platform: NodeJS.Platform;
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
