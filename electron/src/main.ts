import {
  app,
  BrowserWindow,
  ipcMain,
  systemPreferences,
  nativeImage,
} from 'electron';
import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';
import * as http from 'http';
import { createTray, updateTrayMenu, setRecordingIcon } from './tray';

// ── Constants ────────────────────────────────────────────────────────────────

const IS_DEV = !app.isPackaged;
const FRONTEND_DEV_URL = 'http://localhost:5173';
const BACKEND_HEALTH_TIMEOUT_MS = 30_000;
const BACKEND_RESTART_DELAY_MS = 2_000;
const MAX_BACKEND_RESTARTS = 3;

// ── State ────────────────────────────────────────────────────────────────────

let backendProcess: ChildProcess | null = null;
let backendPort: number = 0;
let backendRestartCount = 0;
let isQuitting = false;

let libraryWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;

// ── Backend Management ───────────────────────────────────────────────────────

function getBackendPath(): string {
  if (IS_DEV) {
    return path.join(process.cwd(), 'backend');
  }
  return path.join(process.resourcesPath, 'backend');
}

function getPythonPath(): string {
  const backendDir = getBackendPath();
  if (IS_DEV) {
    // In dev, use the venv python if available, otherwise system python
    // Try venv first (setup.sh creates this), then .venv as fallback
    const venvPython = path.join(backendDir, 'venv', 'bin', 'python');
    return venvPython;
  }
  return path.join(backendDir, 'venv', 'bin', 'python');
}

async function findFreePort(): Promise<number> {
  // Dynamic import for ESM-only get-port
  const { default: getPort } = await import('get-port');
  return getPort({ port: [8765, 8766, 8767, 8768, 8769] });
}

function startBackend(port: number): ChildProcess {
  const backendDir = getBackendPath();
  const pythonPath = getPythonPath();

  console.log(`[Backend] Starting on port ${port}`);
  console.log(`[Backend] Python: ${pythonPath}`);
  console.log(`[Backend] Working dir: ${backendDir}`);

  const proc = spawn(pythonPath, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: backendDir,
    env: {
      ...process.env,
      PYTHONUNBUFFERED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  proc.stdout?.on('data', (data: Buffer) => {
    console.log(`[Backend stdout] ${data.toString().trim()}`);
  });

  proc.stderr?.on('data', (data: Buffer) => {
    console.error(`[Backend stderr] ${data.toString().trim()}`);
  });

  proc.on('error', (err: Error) => {
    console.error('[Backend] Failed to start:', err.message);
  });

  proc.on('exit', (code: number | null, signal: string | null) => {
    console.log(`[Backend] Exited with code=${code} signal=${signal}`);
    if (!isQuitting && backendRestartCount < MAX_BACKEND_RESTARTS) {
      console.log(`[Backend] Auto-restarting (attempt ${backendRestartCount + 1}/${MAX_BACKEND_RESTARTS})...`);
      backendRestartCount++;
      setTimeout(() => {
        backendProcess = startBackend(port);
      }, BACKEND_RESTART_DELAY_MS);
    }
  });

  return proc;
}

function waitForBackendHealth(port: number): Promise<void> {
  const startTime = Date.now();
  const baseDelay = 200;

  return new Promise((resolve, reject) => {
    function check(attempt: number) {
      if (Date.now() - startTime > BACKEND_HEALTH_TIMEOUT_MS) {
        reject(new Error('Backend health check timed out after 30s'));
        return;
      }

      const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
        if (res.statusCode === 200) {
          console.log('[Backend] Health check passed');
          resolve();
        } else {
          scheduleRetry(attempt);
        }
      });

      req.on('error', () => {
        scheduleRetry(attempt);
      });

      req.setTimeout(2000, () => {
        req.destroy();
        scheduleRetry(attempt);
      });
    }

    function scheduleRetry(attempt: number) {
      const delay = Math.min(baseDelay * Math.pow(2, attempt), 3000);
      setTimeout(() => check(attempt + 1), delay);
    }

    check(0);
  });
}

function killBackend(): void {
  if (backendProcess && !backendProcess.killed) {
    console.log('[Backend] Sending SIGTERM...');
    isQuitting = true;
    backendProcess.kill('SIGTERM');

    // Force kill after 5 seconds if still alive
    setTimeout(() => {
      if (backendProcess && !backendProcess.killed) {
        console.log('[Backend] Force killing with SIGKILL...');
        backendProcess.kill('SIGKILL');
      }
    }, 5000);
  }
}

// ── Window Management ────────────────────────────────────────────────────────

function getPreloadPath(): string {
  return path.join(__dirname, 'preload.js');
}

function getFrontendURL(): string {
  if (IS_DEV) {
    return FRONTEND_DEV_URL;
  }
  return `file://${path.join(process.resourcesPath, 'frontend', 'dist', 'index.html')}`;
}

function createLibraryWindow(): BrowserWindow {
  if (libraryWindow && !libraryWindow.isDestroyed()) {
    libraryWindow.show();
    libraryWindow.focus();
    return libraryWindow;
  }

  libraryWindow = new BrowserWindow({
    width: 1060,
    height: 680,
    minWidth: 860,
    minHeight: 520,
    title: 'Meeting Recorder - Library',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    show: false,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const url = getFrontendURL();
  if (url.startsWith('file://')) {
    libraryWindow.loadFile(url.replace('file://', ''));
  } else {
    libraryWindow.loadURL(url);
  }

  libraryWindow.once('ready-to-show', () => {
    libraryWindow?.show();
  });

  libraryWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      libraryWindow?.hide();
    }
  });

  libraryWindow.on('closed', () => {
    libraryWindow = null;
  });

  return libraryWindow;
}

function createSettingsWindow(): BrowserWindow {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return settingsWindow;
  }

  settingsWindow = new BrowserWindow({
    width: 540,
    height: 480,
    resizable: false,
    title: 'Meeting Recorder - Settings',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    show: false,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const url = getFrontendURL();
  const settingsUrl = url.startsWith('file://')
    ? url.replace('file://', '')
    : `${url}/#/settings`;

  if (url.startsWith('file://')) {
    settingsWindow.loadFile(settingsUrl);
  } else {
    settingsWindow.loadURL(settingsUrl);
  }

  settingsWindow.once('ready-to-show', () => {
    settingsWindow?.show();
  });

  settingsWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      settingsWindow?.hide();
    }
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  return settingsWindow;
}

// ── Backend HTTP Proxy Helpers ───────────────────────────────────────────────

function backendRequest(method: string, endpoint: string, body?: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const url = `http://127.0.0.1:${backendPort}${endpoint}`;
    const options: http.RequestOptions = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };

    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => {
        data += chunk.toString();
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });

    req.on('error', (err: Error) => {
      reject(err);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Backend request timed out'));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// ── IPC Handlers ─────────────────────────────────────────────────────────────

function registerIpcHandlers(): void {
  ipcMain.handle('recording:start', async () => {
    try {
      // Request microphone access on first use
      if (process.platform === 'darwin') {
        const micAccess = systemPreferences.getMediaAccessStatus('microphone');
        if (micAccess !== 'granted') {
          const granted = await systemPreferences.askForMediaAccess('microphone');
          if (!granted) {
            return { success: false, error: 'Microphone access denied' };
          }
        }
      }
      const result = await backendRequest('POST', '/api/recording/start');
      setRecordingIcon(true);
      updateTrayMenu({ isRecording: true, isMonitoring: false });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('recording:stop', async () => {
    try {
      const result = await backendRequest('POST', '/api/recording/stop');
      setRecordingIcon(false);
      updateTrayMenu({ isRecording: false, isMonitoring: false });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('recording:status', async () => {
    try {
      const result = await backendRequest('GET', '/api/recording/status');
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('window:open-library', () => {
    createLibraryWindow();
    return { success: true };
  });

  ipcMain.handle('window:open-settings', () => {
    createSettingsWindow();
    return { success: true };
  });

  ipcMain.handle('app:get-backend-url', () => {
    return `http://127.0.0.1:${backendPort}`;
  });

  ipcMain.handle('app:set-login-item', (_event, enabled: boolean) => {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      openAsHidden: true,
    });
    return { success: true };
  });

  ipcMain.handle('app:get-login-item', () => {
    return app.getLoginItemSettings();
  });
}

// ── App Lifecycle ────────────────────────────────────────────────────────────

app.on('window-all-closed', (e: Event) => {
  // Prevent default quit - we're a tray app
  e.preventDefault();
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  killBackend();
});

app.whenReady().then(async () => {
  // Hide dock icon - this is a menu bar app
  if (app.dock) {
    app.dock.hide();
  }

  // Find a free port and start the backend
  try {
    backendPort = await findFreePort();
    backendProcess = startBackend(backendPort);
    await waitForBackendHealth(backendPort);
    console.log(`[App] Backend running on port ${backendPort}`);
  } catch (err) {
    console.error('[App] Failed to start backend:', (err as Error).message);
    // Continue anyway - tray should still work
  }

  // Register IPC handlers
  registerIpcHandlers();

  // Create system tray
  createTray({
    onStartRecording: async () => {
      try {
        if (process.platform === 'darwin') {
          const micAccess = systemPreferences.getMediaAccessStatus('microphone');
          if (micAccess !== 'granted') {
            const granted = await systemPreferences.askForMediaAccess('microphone');
            if (!granted) {
              console.error('[App] Microphone access denied');
              return;
            }
          }
        }
        await backendRequest('POST', '/api/recording/start');
        setRecordingIcon(true);
        updateTrayMenu({ isRecording: true, isMonitoring: false });
      } catch (err) {
        console.error('[App] Failed to start recording:', (err as Error).message);
      }
    },
    onStopRecording: async () => {
      try {
        await backendRequest('POST', '/api/recording/stop');
        setRecordingIcon(false);
        updateTrayMenu({ isRecording: false, isMonitoring: false });
      } catch (err) {
        console.error('[App] Failed to stop recording:', (err as Error).message);
      }
    },
    onToggleMonitoring: async (enabled: boolean) => {
      try {
        const endpoint = enabled ? '/api/detector/start' : '/api/detector/stop';
        await backendRequest('POST', endpoint);
        updateTrayMenu({ isRecording: false, isMonitoring: enabled });
      } catch (err) {
        console.error('[App] Failed to toggle monitoring:', (err as Error).message);
      }
    },
    onOpenLibrary: () => {
      createLibraryWindow();
    },
    onOpenSettings: () => {
      createSettingsWindow();
    },
    onQuit: () => {
      isQuitting = true;
      app.quit();
    },
  });
});
